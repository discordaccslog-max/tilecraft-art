'use strict';
/* Four Seasons Terrain Studio. Everything is drawn with colour roles; each season maps the
 * roles onto one shared master palette, so one drawing becomes four seasonal tilesets. */
const { Raster, Palette, mulberry32, hash2, pnoise, dither, wobble, mod } = require('../lib/raster.js');
const { Pack } = require('../lib/pack.js');
const TR = require('../lib/terrain.js');
const K = require('../lib/kit.js');
const A = require('../lib/art.js');

const M = {
  out: '#1d1a28',
  G1: '#2e5e3a', G2: '#4c8a45', G3: '#7cbf5a', G4: '#b7e27c',
  S1: '#1f4a33', S2: '#357a3f', S3: '#5aa24a', S4: '#93cc5e',
  A1: '#4a4026', A2: '#7a6a32', A3: '#a9923f', A4: '#d4bb63',
  L1: '#6e2c22', L2: '#a8452a', L3: '#d9743a', L4: '#f2a94a',
  W0: '#8892b0', W1: '#b4bfd6', W2: '#dbe3ef', W3: '#f7f9fc',
  pink: '#f28fb0', pinkLight: '#ffd0de', yellow: '#f4cf4f', red: '#c43d3d',
  B0: '#3a261e', B1: '#5f3d2a', B2: '#8a5c3a',
  D0: '#3c2a22', D1: '#5e4030', D2: '#85603f', D3: '#ad8557',
  N0: '#9c7c4f', N1: '#c8a56c', N2: '#e2c891', N3: '#f4e4b8',
  R0: '#3e3d4c', R1: '#646577', R2: '#8f91a0', R3: '#c4c5ca',
  Q0: '#1b3555', Q1: '#24527f', Q2: '#3176a6', Q3: '#5aa6cc', Q4: '#a8e0e6',
  I1: '#6f9cc2', I2: '#a9d2ea',
  M0: '#23352c', M1: '#375043', M2: '#567058',
  C1: '#2f5a3e', C2: '#4a7d4a'
};
const NAMES = {}; for (const [k, v] of Object.entries(M)) NAMES[v] = k;
const roles = {
  out: ['out', 'out', 'out', 'out'],
  grass0: ['G1', 'S1', 'A1', 'W0'], grass1: ['G2', 'S2', 'A2', 'W1'], grass2: ['G3', 'S3', 'A3', 'W2'], grass3: ['G4', 'S4', 'A4', 'W3'],
  leaf0: ['S1', 'S1', 'L1', 'W0'], leaf1: ['G2', 'S2', 'L2', 'W1'], leaf2: ['G3', 'S3', 'L3', 'W2'], leaf3: ['G4', 'S4', 'L4', 'W3'],
  blossom0: ['pink', 'yellow', 'red', 'W2'], blossom1: ['pinkLight', 'W3', 'L4', 'W3'],
  bark0: ['B0', 'B0', 'B0', 'B0'], bark1: ['B1', 'B1', 'B1', 'B1'], bark2: ['B2', 'B2', 'B2', 'B2'],
  soil0: ['D0', 'D0', 'D0', 'D0'], soil1: ['D1', 'D1', 'D1', 'D1'], soil2: ['D2', 'D2', 'D2', 'W1'], soil3: ['D3', 'D3', 'D3', 'W2'],
  sand0: ['N0', 'N0', 'N0', 'N0'], sand1: ['N1', 'N1', 'N1', 'N1'], sand2: ['N2', 'N2', 'N2', 'N2'], sand3: ['N3', 'N3', 'N3', 'W3'],
  rock0: ['R0', 'R0', 'R0', 'R0'], rock1: ['R1', 'R1', 'R1', 'R1'], rock2: ['R2', 'R2', 'R2', 'R2'], rock3: ['R3', 'R3', 'R3', 'W3'],
  water0: ['Q0', 'Q0', 'Q0', 'I1'], water1: ['Q1', 'Q1', 'Q1', 'I1'], water2: ['Q2', 'Q2', 'Q1', 'I2'], water3: ['Q3', 'Q3', 'Q2', 'W2'], water4: ['Q4', 'Q4', 'Q3', 'W3'],
  snow0: ['W0', 'W0', 'W0', 'W0'], snow1: ['W1', 'W1', 'W1', 'W1'], snow2: ['W2', 'W2', 'W2', 'W2'], snow3: ['W3', 'W3', 'W3', 'W3'],
  murk0: ['M0', 'M0', 'M0', 'W0'], murk1: ['M1', 'M1', 'M1', 'W1'], murk2: ['M2', 'M2', 'M2', 'W2'],
  moss0: ['G1', 'S1', 'A1', 'W0'], moss1: ['G2', 'S2', 'A2', 'W1'], moss2: ['G3', 'S3', 'A3', 'W2'],
  cactus0: ['C1', 'C1', 'C1', 'C1'], cactus1: ['C2', 'C2', 'C2', 'C2'], cactus2: ['S3', 'S3', 'S3', 'S3']
};
const SEASONS = [['spring', 'Spring'], ['summer', 'Summer'], ['autumn', 'Autumn'], ['winter', 'Winter']];
const P = new Palette(Object.keys(roles).map(r => [r, M[roles[r][0]]]));
const variants = SEASONS.map(([id, name], si) => ({ id, name, map: Object.fromEntries(Object.entries(roles).map(([r, v]) => [r, M[v[si]]])) }));

/* ---------- shared painters ---------- */
const wob = (seed, amp = 1) => t => wobble(mod(t, 16), 16, amp, seed);
const tex = (seed, fn) => { const L = new Raster(16, 16); fn(L, mulberry32(seed)); return (x, y) => L.get(mod(x, 16), mod(y, 16)); };
function scatter(L, rng, n, draw) { for (let i = 0; i < n; i++) draw(Math.floor(rng() * 16), Math.floor(rng() * 16)); }
const wrapSet = L => (x, y, c) => L.set(mod(x, 16), mod(y, 16), c);
function groundTex(base, light, dark, seed, deco) {
  const D = tex(seed, (L, rng) => deco && deco(wrapSet(L), rng));
  /* variant v keeps the shared 2-pixel border band and gets its own interior */
  return (x, y, v = 0) => {
    const lx = mod(x, 16), ly = mod(y, 16), band = K.inBand(lx, ly);
    const Dv = band || !v ? D : (groundTex.cache[seed + ':' + v] = groundTex.cache[seed + ':' + v] || tex(seed + v * 31, (L, rng) => deco && deco(wrapSet(L), rng)));
    const d = Dv(x, y); if (d) return d;
    const n = pnoise(lx, ly, 8, 16, band ? seed : seed + v * 13);
    if (n > 0.64 && dither(lx, ly, (n - 0.64) * 3)) return light;
    if (n < 0.3 && dither(lx + 1, ly, (0.3 - n) * 2.4)) return dark;
    return base;
  };
}
const tufts = (n, a, b, c) => (set, rng) => { for (let i = 0; i < n; i++) { const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16); set(x, y, c); set(x + 2, y, c); set(x + 1, y + 1, b); set(x + 1, y + 2, a); } };
function patchPainter(R, inner) {
  return (x, y, q) => {
    if (!q.inside(x, y)) return 0;
    const p = q.probe(x, y, 3);
    if (p.up === 0) return R.edgeTop; if (p.up === 1) return R.edge;
    if (p.ring) return R.edge;
    if (p.down === 1) return R.lip;
    return inner(x, y);
  };
}
function waterPainter(R) {
  const RIP = (() => { const rng = mulberry32(R.seed || 5); const l = []; for (let i = 0; i < 6; i++) l.push({ x: Math.floor(rng() * 16), y: Math.floor(rng() * 16), len: 2 + Math.floor(rng() * 3), ph: i % 4 }); return l; })();
  return (x, y, q, f) => {
    if (!q.inside(x, y)) return 0;
    const p = q.probe(x, y, 4);
    if (p.up === 0) return R.bankTop; if (p.up === 1) return R.bank;
    if (p.left === 0 || p.right === 0) return p.up <= 2 ? R.bank : R.w0;
    if (p.down === 0) return R.w4;
    if (p.up === 2 || (R.surf && p.down === 1)) return mod(x - f * 2, 8) < 5 ? R.foam : R.w4;
    if (R.surf && p.down === 2) return mod(x + f * 2, 8) < 3 ? R.foam : R.w3;
    if (p.left === 1 || p.right === 1) return mod(y + f, 4) < 2 ? R.w3 : R.w2;
    if (p.down === 1 || p.up === 3) return R.w3;
    const lx = mod(x, 16), ly = mod(y, 16);
    for (const r of RIP) { const st = (r.ph + f) % 4; if (st === 3) continue; const rx = mod(r.x + (st === 2 ? 1 : 0), 16); if (ly === r.y && mod(lx - rx, 16) < r.len) return st === 1 ? R.w4 : R.w3; }
    if (R.dots && hash2(lx, ly, 3) < 0.05) return R.dots;
    return p.min >= 4 ? R.w1 : R.w2;
  };
}
groundTex.cache = {};
const blobShape = s => TR.shape({ top: 3, bottom: 3, left: 3, right: 3, wobTop: wob(s), wobBottom: wob(s + 1), wobLeft: wob(s + 2), wobRight: wob(s + 3), outer: 5, inner: 3 });

/* ---------- objects ---------- */
const sh = (r, cx, cy, rx, ry, ink) => A.shadow(r, cx, cy, rx, ry, ink);
function cactus(Pp) {
  const r = new Raster(16, 32);
  sh(r, 8, 29.5, 5, 1.5, Pp.sand0);
  const body = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) r.set(x, y, x === x0 + 1 ? Pp.cactus2 : x >= x1 - 1 ? Pp.cactus0 : Pp.cactus1); };
  body(6, 8, 10, 29); body(2, 15, 5, 21); body(11, 12, 14, 19); r.rect(5, 19, 1, 2, Pp.cactus1); r.rect(11, 17, 1, 2, Pp.cactus1);
  r.rect(7, 7, 3, 1, Pp.cactus1); r.rect(3, 14, 2, 1, Pp.cactus1); r.rect(12, 11, 2, 1, Pp.cactus1);
  for (let y = 10; y < 28; y += 3) r.set(8, y, Pp.cactus0);
  r.set(8, 6, Pp.blossom0); r.set(7, 6, Pp.blossom1);
  r.outline(Pp.out);
  return r;
}
function palm(Pp, f) {
  const r = new Raster(32, 48);
  sh(r, 16, 45, 8, 2, Pp.sand0);
  for (let y = 18; y <= 44; y++) { const x = Math.round(14 + Math.sin((44 - y) / 26 * 1.6) * 4); r.rect(x, y, 3, 1, mod(y, 3) === 0 ? Pp.bark0 : Pp.bark1); r.set(x, y, Pp.bark2); }
  const sway = [0, 1, 0, -1][f];
  const top = [17, 16];
  for (let k = 0; k < 6; k++) {
    const ang = -Math.PI + (k + 0.5) / 6 * Math.PI + (k < 3 ? -0.15 : 0.15);
    const len = 11 + (k % 2) * 2;
    for (let t = 0; t <= len; t++) {
      const x = top[0] + Math.cos(ang) * t + sway * (t / len), y = top[1] + Math.sin(ang) * t * 0.55 + (t * t) / len * 0.45;
      r.set(Math.round(x), Math.round(y), t < len * 0.3 ? Pp.cactus0 : Pp.cactus1);
      if (t % 2 && t > 2) r.set(Math.round(x), Math.round(y) + 1, Pp.cactus2);
    }
  }
  r.disc(17, 17, 1.6, Pp.bark1);
  r.outline(Pp.out);
  return r;
}
function fern(Pp, f) {
  const r = new Raster(16, 16);
  const sway = [0, 1, 0, -1][f];
  for (let k = 0; k < 5; k++) {
    const ang = -Math.PI * (0.15 + k * 0.175);
    for (let t = 1; t < 8; t++) {
      const x = 8 + Math.cos(ang) * t + sway * t / 8, y = 14 + Math.sin(ang) * t + t * t * 0.06;
      r.set(Math.round(x), Math.round(y), t > 5 ? Pp.moss2 : Pp.moss1);
      if (t % 2) r.set(Math.round(x + Math.sin(ang)), Math.round(y - Math.cos(ang) * 0.5), Pp.moss0);
    }
  }
  return r;
}
function reeds(Pp, f) {
  const r = new Raster(16, 16);
  const sway = [0, 1, 0, -1][f];
  [[3, 9], [6, 12], [9, 10], [12, 11]].forEach(([x, h], i) => {
    for (let k = 0; k < h; k++) { const t = k / h; r.set(x + Math.round((sway + (i % 2 ? 0.5 : -0.5)) * t * t * 2), 15 - k, k < 3 ? Pp.grass0 : Pp.grass1); }
    if (i % 2 === 0) { const tx = x + Math.round((sway - 0.5) * 2); r.vline(tx, 15 - h - 2, 15 - h, Pp.bark1); }
  });
  return r;
}
function seagrass(Pp, f) {
  const r = new Raster(16, 16);
  const sway = [0, 1, 0, -1][f];
  for (let i = 0; i < 6; i++) { const x = 2 + i * 2, h = 5 + (i * 7) % 6; for (let k = 0; k < h; k++) { const t = k / h; r.set(x + Math.round(Math.sin(t * 3 + i) * 0.8 + sway * t), 15 - k, k > h - 2 ? Pp.grass3 : Pp.grass2); } }
  return r;
}
function tallgrass(Pp, f, seed) {
  const r = new Raster(16, 16);
  const rng = mulberry32(seed), sway = [0, 1, 0, -1][f];
  r.ellipse(8, 14, 5.5, 1.8, Pp.grass0);
  for (let i = 0; i < 11; i++) { const x = 3 + Math.floor(i * 10 / 11 + rng() * 1.5), h = 6 + Math.floor(rng() * 6); A.blades(r, x, 15 - Math.floor(rng() * 2), h, (x < 8 ? -1 : 1) * (0.5 + rng()) + sway * (0.8 + h / 9), i % 3 ? { base: Pp.grass0, mid: Pp.grass2, tip: Pp.grass3 } : { base: Pp.grass0, mid: Pp.grass1, tip: Pp.grass2 }); }
  return r;
}
function flowersSway(Pp, f) {
  const r = new Raster(16, 16);
  const sway = [0, 1, 0, -1][f];
  [[4, 6], [8, 4], [12, 7], [6, 10], [11, 11]].forEach(([x, y], i) => {
    const h = 15 - y, top = y;
    for (let k = 0; k < h; k++) r.set(x + Math.round(sway * (1 - k / h) * (i % 2 ? 1 : 0.6)), 15 - k, Pp.grass1);
    const tx = x + Math.round(sway * (i % 2 ? 1 : 0.6));
    r.set(tx, top, Pp.blossom1); r.set(tx - 1, top, Pp.blossom0); r.set(tx + 1, top, Pp.blossom0); r.set(tx, top - 1, Pp.blossom0);
  });
  return r;
}
function lily(Pp) { const r = new Raster(16, 16); for (const [cx, cy, rad] of [[5, 6, 3.5], [11, 10, 3]]) { r.ellipse(cx, cy, rad, rad * 0.75, Pp.grass2); r.set(Math.round(cx), Math.round(cy), Pp.water2); } r.edgeShade(0, 1, Pp.grass0); r.set(5, 4, Pp.blossom1); r.set(4, 5, Pp.blossom0); r.set(6, 5, Pp.blossom0); return r; }
function shells(Pp) { const r = new Raster(16, 16); r.ellipse(5, 9, 2.4, 2, Pp.blossom1); r.set(4, 8, Pp.sand3); r.ellipse(11, 7, 1.8, 1.5, Pp.sand3); r.set(10, 12, Pp.blossom0); r.set(11, 12, Pp.blossom1); r.outline(Pp.out); return r; }
function driftwood(Pp) { const r = new Raster(32, 16); r.rect(3, 7, 25, 4, Pp.bark2); r.hline(3, 27, 7, Pp.sand2); r.hline(3, 27, 10, Pp.bark1); r.line(20, 6, 24, 3, Pp.bark2); r.line(8, 11, 6, 13, Pp.bark1); r.outline(Pp.out); return r; }
function deadTree(Pp) {
  const r = new Raster(16, 32);
  r.rect(7, 12, 3, 17, Pp.bark1); r.vline(7, 12, 28, Pp.bark2);
  r.line(8, 16, 3, 9, Pp.bark1); r.line(8, 14, 13, 7, Pp.bark1); r.line(5, 12, 4, 6, Pp.bark1); r.line(11, 10, 12, 4, Pp.bark1); r.line(8, 12, 8, 3, Pp.bark1);
  r.outline(Pp.out);
  return r;
}
function willow(Pp, f) {
  const r = new Raster(32, 48);
  sh(r, 16, 44.5, 9, 2.4, Pp.grass0);
  A.trunk(r, 16, 26, 43, 5, { o: Pp.out, d: Pp.bark0, m: Pp.bark1, l: Pp.bark2 });
  A.crown(r, [[16, 14, 11], [9, 17, 7], [23, 17, 7]], { o: Pp.out, c: [Pp.leaf0, Pp.leaf0, Pp.leaf1, Pp.leaf2, Pp.leaf3] }, 4, { spacing: 5, clump: 3.4 });
  const sway = [0, 1, 0, -1][f];
  for (let k = 0; k < 9; k++) { const x0 = 6 + k * 2.5, len = 10 + (k * 5) % 6; for (let t = 0; t < len; t++) r.set(Math.round(x0 + sway * (t / len)), 20 + t, t === len - 1 ? Pp.leaf2 : (t % 2 ? Pp.leaf1 : Pp.leaf2)); }
  return r;
}
function snowPine(Pp) {
  const r = A.conifer({ leaf: { o: Pp.out, c: [Pp.moss0, Pp.moss0, Pp.moss1, Pp.moss2, Pp.moss2] }, bark: { o: Pp.out, d: Pp.bark0, m: Pp.bark1, l: Pp.bark2 }, shadow: Pp.snow1 }, 7);
  r.each((x, y, v) => { if (v && v !== Pp.out && !r.get(x, y - 2) === false && (r.get(x, y - 1) === Pp.out || !r.get(x, y - 1))) { if (v === Pp.moss1 || v === Pp.moss2 || v === Pp.moss0) r.set(x, y, Pp.snow3); } });
  return r;
}
function snowRock(Pp) { const r = new Raster(16, 16); sh(r, 8, 13, 6, 1.5, Pp.snow1); A.rock(r, 8, 9, 6, 4.5, { o: Pp.out, d: Pp.rock1, m: Pp.rock2, l: Pp.rock3, h: Pp.snow3 }, 3, { moss: [Pp.snow2, Pp.snow3] }); return r; }
function crystal(Pp) { const r = new Raster(16, 16); for (const [cx, top, half] of [[8, 3, 2], [5, 7, 1.5], [11, 6, 1.5]]) for (let y = top; y <= 13; y++) { const w = Math.min(half, (y - top) * 0.7); for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) r.set(x, y, x < cx ? Pp.snow3 : x === cx ? Pp.water4 : Pp.water3); } r.outline(Pp.out); return r; }
function snowdrift(Pp) { const r = new Raster(32, 16); r.ellipse(12, 11, 9, 4, Pp.snow2); r.ellipse(22, 12, 7, 3, Pp.snow2); r.ellipse(11, 9.5, 6, 2.2, Pp.snow3); r.ellipse(21, 11, 4, 1.4, Pp.snow3); r.edgeShade(0, 1, Pp.snow1); r.outline(Pp.snow0); return r; }
function mushrooms(Pp) {
  const r = new Raster(16, 16);
  const key = { o: Pp.out, H: Pp.sand3, h: Pp.soil3, m: Pp.soil2, d: Pp.soil1, S: Pp.sand3, s: Pp.sand1 };
  r.pattern(1, 4, ['..oooo..', '.oHhhmo.', 'oHhmmmmo', 'ommmmmdo', '.oddddo.', '..oSso..', '..oSso..', '..oSso..', '..oooo..'], key);
  r.pattern(9, 7, ['.ooo.', 'ohmmo', 'ommdo', '.oSo.', '.oSo.', '.oo..'], key);
  return r;
}
function dryBush(Pp) { const r = new Raster(16, 16); const rng = mulberry32(4); for (let k = 0; k < 9; k++) { const a = -Math.PI * (0.1 + k * 0.1), len = 4 + rng() * 4; r.line(8, 14, Math.round(8 + Math.cos(a) * len), Math.round(14 + Math.sin(a) * len), k % 2 ? Pp.soil2 : Pp.soil3); } sh(r, 8, 15, 4, 0.8, Pp.sand0); return r; }

/* ---------- biomes ---------- */
function biomes(Pp) {
  return [
    { id: 'meadow', name: 'Meadow', ground: groundTex(Pp.grass1, Pp.grass2, Pp.grass0, 11, tufts(6, Pp.grass0, Pp.grass2, Pp.grass3)),
      groundDeco: [s => { s(6, 7, Pp.blossom0); s(7, 7, Pp.blossom1); s(11, 10, Pp.blossom0); }, s => { s(5, 9, Pp.rock2); s(6, 9, Pp.rock1); s(10, 5, Pp.rock2); }, s => { s(4, 5, Pp.grass3); s(6, 5, Pp.grass3); s(5, 6, Pp.grass2); s(10, 10, Pp.grass3); s(12, 10, Pp.grass3); s(11, 11, Pp.grass2); }],
      A: { id: 'dirt', name: 'Dirt', paint: patchPainter({ edgeTop: Pp.soil0, edge: Pp.soil1, lip: Pp.soil3 }, groundTex(Pp.soil2, Pp.soil3, Pp.soil1, 21, (s, rng) => scatter(null, rng, 0, () => { }))) },
      B: { id: 'pond', name: 'Pond', paint: waterPainter({ bankTop: Pp.soil2, bank: Pp.soil1, w0: Pp.water0, w1: Pp.water1, w2: Pp.water2, w3: Pp.water3, w4: Pp.water4, foam: Pp.snow3, seed: 3 }) },
      shadow: Pp.grass0 },
    { id: 'forest', name: 'Forest', ground: groundTex(Pp.moss0, Pp.moss1, Pp.grass0, 12, (s, rng) => { for (let i = 0; i < 5; i++) { const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16); s(x, y, i % 2 ? Pp.leaf2 : Pp.soil2); s(x + 1, y, i % 2 ? Pp.leaf1 : Pp.soil1); } }),
      groundDeco: [s => { s(5, 5, Pp.leaf3); s(6, 5, Pp.leaf2); s(10, 11, Pp.leaf2); s(11, 11, Pp.leaf1); }, s => { s(7, 8, Pp.soil3); s(8, 8, Pp.soil2); s(8, 9, Pp.soil1); }, s => { s(4, 10, Pp.moss2); s(5, 10, Pp.moss2); s(5, 9, Pp.moss1); s(11, 5, Pp.moss2); }],
      A: { id: 'underbrush', name: 'Underbrush', shape: TR.shape({ top: 2, bottom: 3, left: 2, right: 2, wobTop: wob(31, 2), wobBottom: wob(32, 1), wobLeft: wob(33, 2), wobRight: wob(34, 2), outer: 5, inner: 3 }),
        paint: (x, y, q) => { if (!q.inside(x, y)) return 0; const p = q.probe(x, y, 3); if (p.ring) return Pp.out; if (p.down === 1) return Pp.leaf0; if (p.up === 1) return Pp.leaf3; const lx = mod(x, 8), ly = mod(y, 8); const off = mod(Math.floor(mod(y, 16) / 8), 2) * 4; const u = mod(lx + off, 8); const d = Math.hypot(u - 3.5, ly - 3.5); return d > 3.7 ? Pp.leaf0 : (u + ly < 4 ? Pp.leaf3 : u + ly < 7 ? Pp.leaf2 : Pp.leaf1); } },
      B: { id: 'stream', name: 'Stream', paint: waterPainter({ bankTop: Pp.soil1, bank: Pp.soil0, w0: Pp.water0, w1: Pp.water1, w2: Pp.water2, w3: Pp.water3, w4: Pp.water4, foam: Pp.snow3, seed: 8 }) },
      shadow: Pp.grass0 },
    { id: 'desert', name: 'Desert', ground: groundTex(Pp.sand2, Pp.sand3, Pp.sand1, 13, (s, rng) => { for (let i = 0; i < 4; i++) { const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16); s(x, y, Pp.sand1); s(x + 1, y, Pp.sand1); s(x + 2, y + 1, Pp.sand1); } }),
      groundDeco: [s => { s(5, 9, Pp.rock2); s(6, 9, Pp.rock1); s(11, 5, Pp.rock2); }, s => { for (let x = 4; x < 12; x++) s(x, 7 + (x % 3 === 0 ? 1 : 0), Pp.sand1); }, s => { s(6, 6, Pp.blossom0); s(6, 7, Pp.cactus1); s(10, 11, Pp.blossom1); s(10, 12, Pp.cactus1); }],
      A: { id: 'mesa', name: 'Mesa cliff', shape: TR.shape({ top: 1, bottom: 6, left: 1, right: 1, wobTop: wob(41), wobLeft: wob(42), wobRight: wob(43), outer: 2, inner: 2 }),
        paint: (x, y, q) => { if (!q.cell(x, y)) return 0; if (q.inside(x, y)) { const p = q.probe(x, y, 2); if (p.ring) return Pp.out; if (p.down === 1) return Pp.rock1; return hash2(mod(x, 16), mod(y, 16), 4) < 0.08 ? Pp.rock2 : Pp.sand1; } if (mod(y, 16) < 9) return 0; for (let k = 1; k <= 7; k++) if (q.inside(x, y - k)) { if (k === 7) return Pp.out; const band = k <= 2 ? Pp.rock2 : k <= 4 ? Pp.rock1 : Pp.rock0; return mod(x + k, 8) === 0 ? Pp.rock0 : band; } return 0; } },
      B: { id: 'oasis', name: 'Oasis', paint: waterPainter({ bankTop: Pp.sand1, bank: Pp.sand0, w0: Pp.water0, w1: Pp.water1, w2: Pp.water2, w3: Pp.water3, w4: Pp.water4, foam: Pp.snow3, seed: 9 }) },
      shadow: Pp.sand1 },
    { id: 'snow', name: 'Snowfield', ground: groundTex(Pp.snow2, Pp.snow3, Pp.snow1, 14, (s, rng) => { for (let i = 0; i < 4; i++) { const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16); s(x, y, Pp.snow1); s(x + 1, y, Pp.snow1); } }),
      groundDeco: [s => { s(5, 6, Pp.snow3); s(10, 10, Pp.snow3); s(6, 6, Pp.water4); }, s => { s(5, 9, Pp.rock1); s(6, 9, Pp.rock2); s(5, 8, Pp.snow3); }, s => { s(4, 7, Pp.grass1); s(5, 6, Pp.grass2); s(11, 10, Pp.grass1); }],
      A: { id: 'tundra', name: 'Tundra grass', paint: patchPainter({ edgeTop: Pp.grass0, edge: Pp.grass0, lip: Pp.grass2 }, groundTex(Pp.grass1, Pp.grass2, Pp.grass0, 22, tufts(4, Pp.grass0, Pp.grass2, Pp.grass3))) },
      B: { id: 'coldwater', name: 'Cold water', paint: waterPainter({ bankTop: Pp.snow1, bank: Pp.snow0, w0: Pp.water0, w1: Pp.water1, w2: Pp.water2, w3: Pp.water3, w4: Pp.water4, foam: Pp.snow3, seed: 10 }) },
      shadow: Pp.snow1 },
    { id: 'swamp', name: 'Swamp', ground: groundTex(Pp.murk2, Pp.moss1, Pp.murk1, 15, (s, rng) => { for (let i = 0; i < 5; i++) { const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16); s(x, y, Pp.soil1); s(x + 1, y, i % 2 ? Pp.moss2 : Pp.soil1); } }),
      groundDeco: [s => { s(5, 6, Pp.moss2); s(6, 6, Pp.moss2); s(5, 7, Pp.moss1); }, s => { s(9, 9, Pp.water3); s(10, 9, Pp.water2); }, s => { s(4, 10, Pp.blossom0); s(11, 5, Pp.blossom1); }],
      A: { id: 'mud', name: 'Mud', paint: patchPainter({ edgeTop: Pp.soil0, edge: Pp.soil0, lip: Pp.soil2 }, (x, y) => { const lx = mod(x, 16), ly = mod(y, 16); if (hash2(lx, ly, 5) < 0.04) return Pp.water4; return pnoise(lx, ly, 8, 16, 6) > 0.6 ? Pp.soil2 : Pp.soil1; }) },
      B: { id: 'bog', name: 'Bog water', paint: waterPainter({ bankTop: Pp.murk1, bank: Pp.murk0, w0: Pp.murk0, w1: Pp.murk0, w2: Pp.murk1, w3: Pp.murk2, w4: Pp.moss2, foam: Pp.moss2, dots: Pp.grass2, seed: 11 }) },
      shadow: Pp.murk1 },
    { id: 'coast', name: 'Coast', ground: groundTex(Pp.sand2, Pp.sand3, Pp.sand1, 16, (s, rng) => { for (let i = 0; i < 3; i++) { const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16); s(x, y, Pp.sand1); } }),
      groundDeco: [s => { s(6, 7, Pp.blossom1); s(7, 7, Pp.blossom0); }, s => { s(5, 10, Pp.rock2); s(10, 6, Pp.rock1); }, s => { s(4, 6, Pp.sand1); s(5, 6, Pp.sand1); s(9, 11, Pp.sand1); s(10, 11, Pp.sand1); }],
      A: { id: 'dunegrass', name: 'Dune grass', shape: TR.shape({ top: 3, bottom: 3, left: 3, right: 3, wobTop: wob(51, 2), wobBottom: wob(52), wobLeft: wob(53), wobRight: wob(54), outer: 5, inner: 3 }),
        paint: (x, y, q) => { if (!q.inside(x, y)) return 0; const p = q.probe(x, y, 3); if (p.up === 0) return mod(x, 4) === 0 ? Pp.grass3 : Pp.grass2; if (p.ring) return Pp.grass0; if (p.down === 1) return Pp.sand1; const lx = mod(x, 16), ly = mod(y, 16); return (mod(lx + ly * 3, 4) === 0 && mod(ly, 2) === 0) ? Pp.grass3 : pnoise(lx, ly, 8, 16, 7) > 0.55 ? Pp.grass2 : Pp.grass1; } },
      B: { id: 'sea', name: 'Sea', paint: waterPainter({ bankTop: Pp.sand1, bank: Pp.sand0, w0: Pp.water0, w1: Pp.water1, w2: Pp.water2, w3: Pp.water3, w4: Pp.water4, foam: Pp.snow3, surf: true, seed: 12 }) },
      shadow: Pp.sand1 }
  ];
}
function decor(Pp, b) {
  const tree = { leaf: { o: Pp.out, c: [Pp.leaf0, Pp.leaf0, Pp.leaf1, Pp.leaf2, Pp.leaf3] }, bark: { o: Pp.out, d: Pp.bark0, m: Pp.bark1, l: Pp.bark2 }, shadow: b.shadow };
  const pine = { leaf: { o: Pp.out, c: [Pp.moss0, Pp.moss0, Pp.moss1, Pp.moss2, Pp.moss2] }, bark: tree.bark, shadow: b.shadow };
  const stone = { o: Pp.out, d: Pp.rock1, m: Pp.rock2, l: Pp.rock3, h: Pp.rock3 };
  const rockT = (seed, moss) => { const r = new Raster(16, 16); sh(r, 8, 13, 6, 1.5, b.shadow); A.rock(r, 8, 9, 6, 4.5, stone, seed, moss ? { moss: [Pp.moss1, Pp.moss2] } : { crack: true }); return r; };
  const f4 = fn => [0, 1, 2, 3].map(fn);
  const L = [];
  const add = (id, name, frames, o = {}) => L.push(Object.assign({ id, name, frames }, o));
  switch (b.id) {
    case 'meadow':
      add('tree', 'Blossom tree', [A.broadleaf(tree, 61, { blossom: [Pp.blossom0, Pp.blossom1] })]);
      add('sapling', 'Young tree', [A.sapling(tree, 62)]);
      add('bush', 'Flowering bush', [A.bush(tree, 63, { dots: [Pp.blossom0, Pp.blossom1], count: 5 })]);
      add('rock', 'Rock', [rockT(64)]);
      add('tallgrass', 'Tall grass', f4(f => tallgrass(Pp, f, 65)), { anim: true });
      add('wildflowers', 'Wildflowers', f4(f => flowersSway(Pp, f)), { anim: true });
      break;
    case 'forest':
      add('pine', 'Fir', [A.conifer(pine, 71)]);
      add('oak', 'Old oak', [A.broadleaf(tree, 72)]);
      add('bush', 'Thicket bush', [A.bush(tree, 73)]);
      add('mossrock', 'Mossy rock', [rockT(74, true)]);
      add('mushrooms', 'Mushrooms', [mushrooms(Pp)]);
      add('fern', 'Fern', f4(f => fern(Pp, f)), { anim: true });
      break;
    case 'desert':
      add('cactus', 'Cactus', [cactus(Pp)]);
      add('palm', 'Palm', f4(f => palm(Pp, f)), { anim: true });
      add('drybush', 'Dry bush', [dryBush(Pp)]);
      add('rock', 'Desert rock', [rockT(81)]);
      add('deadtree', 'Bare tree', [deadTree(Pp)]);
      break;
    case 'snow':
      add('pine', 'Snowy fir', [snowPine(Pp)]);
      add('rock', 'Snowy rock', [snowRock(Pp)]);
      add('crystal', 'Ice crystal', [crystal(Pp)]);
      add('drift', 'Snowdrift', [snowdrift(Pp)]);
      add('deadtree', 'Bare birch', [deadTree(Pp)]);
      add('tallgrass', 'Tundra grass', f4(f => tallgrass(Pp, f, 91)), { anim: true });
      break;
    case 'swamp':
      add('willow', 'Willow', f4(f => willow(Pp, f)), { anim: true });
      add('deadtree', 'Dead tree', [deadTree(Pp)]);
      add('reeds', 'Reeds', f4(f => reeds(Pp, f)), { anim: true });
      add('lily', 'Lily pads', [lily(Pp)]);
      add('mushrooms', 'Bog mushrooms', [mushrooms(Pp)]);
      add('rock', 'Mossy stone', [rockT(101, true)]);
      break;
    case 'coast':
      add('palm', 'Coconut palm', f4(f => palm(Pp, f)), { anim: true });
      add('rock', 'Shore rock', [rockT(111)]);
      add('shells', 'Shells', [shells(Pp)]);
      add('driftwood', 'Driftwood', [driftwood(Pp)]);
      add('seagrass', 'Sea grass', f4(f => seagrass(Pp, f)), { anim: true });
      add('bush', 'Dune shrub', [A.bush(tree, 112)]);
      break;
  }
  return L;
}

function build() {
  const pack = new Pack({ id: 'four-seasons', name: 'Four Seasons Terrain Studio', code: 'FS', palette: P, variants, reviewVariants: 4 });
  pack.colorNames = NAMES;
  const grounds = [];
  pack.extra.biomes = [];
  for (const b of biomes(P)) {
    const sheet = pack.sheet(b.id, { name: `${b.name} terrain`, cols: 16 });
    const ws = pack.sheet(`${b.id}-water`, { name: `${b.name} water`, cols: 16 });
    const ids = [];
    const variantsG = [() => { }, () => { }, () => { }, ...b.groundDeco];
    variantsG.forEach((d, i) => { const r = Raster.from(16, 16, (x, y) => b.ground(x, y, i % 3)); d((x, y, c) => r.set(x, y, c)); ids.push(pack.add(b.id, { id: `fs-${b.id}-ground-${i + 1}`, name: `${b.name} ground ${i + 1}`, category: `${b.name}: ground`, frames: [r], meta: { ground: b.id, biome: b.id } }).id); });
    grounds.push({ id: b.id, name: b.name, assets: ids, plain: 3 });
    K.addBlobSet(pack, { sheet: b.id, id: `${b.id}-${b.A.id}`, prefix: 'fs', name: `${b.name} ${b.A.name.toLowerCase()}`, category: `${b.name}: ${b.A.name.toLowerCase()} (autotile)`, shape: b.A.shape || blobShape(b.id.length * 7), painter: b.A.paint, order: 1, tags: [b.id] });
    K.addBlobSet(pack, { sheet: ws.id, id: `${b.id}-${b.B.id}`, prefix: 'fs', name: `${b.name} ${b.B.name.toLowerCase()}`, category: `${b.name}: ${b.B.name.toLowerCase()} (autotile)`, shape: blobShape(b.id.length * 11), painter: b.B.paint, frames: 4, duration: 230, order: 2, newRow: false, tags: [b.id] });
    pack.newRow(b.id);
    for (const d of decor(P, b)) pack.add(b.id, { id: `fs-${b.id}-${d.id}`, name: d.name, category: `${b.name}: ${d.anim ? 'animated foliage' : 'decor'}`, frames: d.frames, duration: d.anim ? 200 : undefined, tags: [b.id].concat(d.anim ? ['animated'] : []), meta: { biome: b.id } });
    pack.extra.biomes.push({ id: b.id, name: b.name, sheets: [sheet.id, ws.id], sets: [`${b.id}-${b.A.id}`, `${b.id}-${b.B.id}`] });
  }
  for (const t of pack.autotiles) t.biome = t.id.split('-')[0];
  pack.extra.ground = grounds;
  pack.extra.seasons = SEASONS.map(([id, name]) => ({ id, name }));
  sampleMaps(pack);
  return pack;
}

function sampleMaps(pack) {
  const G = K.grids, W = 24, H = 16;
  for (const b of pack.extra.biomes) {
    const g = pack.extra.ground.find(x => x.id === b.id).assets;
    const decoIds = pack.assets.filter(a => a.id.startsWith(`fs-${b.id}-`) && !a.id.includes('ground') && !a.meta?.autotile).map(a => a.id);
    for (const [season] of SEASONS) {
      const mb = new K.MapBuilder(pack, `${b.id}-${season}`, `${b.name} (${season})`, W, H, season);
      mb.fill('Ground', (x, y) => K.pickGround(pack.extra.ground.find(x2 => x2.id === b.id), x, y));
      const a = G.clean(G.union(G.blob(W, H, 6, 5, 4.5, 3.2, 3), G.blob(W, H, 9, 12, 3.5, 2.6, 4)), W, H);
      const w = G.clean(G.blob(W, H, 17, 9, 5.5, 4.4, 5), W, H);
      mb.terrain(b.sets[0].split('-').slice(1).join(' '), b.sets[0], G.minus(a, w));
      mb.terrain('Water', b.sets[1], w);
      const spots = [[1, 1], [12, 1], [21, 2], [2, 9], [12, 6], [21, 12], [5, 13], [14, 13], [0, 5], [19, 0]];
      decoIds.forEach((id, i) => { for (const k of [i, i + decoIds.length]) { const s = spots[k % spots.length]; if (!s) continue; const asset = pack.asset(id); if (s[0] + asset.cw <= W && s[1] + asset.ch <= H) mb.stamp('Decor', id, s[0], s[1]); } });
      mb.done();
    }
  }
}

module.exports = { build, palette: P };
