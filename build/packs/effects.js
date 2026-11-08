'use strict';
const { Raster, Palette, mulberry32, dither } = require('../lib/raster.js');
const { Pack } = require('../lib/pack.js');

const RAMPS = {
  gold: ['#fff7d6', '#ffe27c', '#f5b83c', '#c87a22', '#7b4318'],
  teal: ['#e8fff9', '#a2f5e3', '#4fd7c3', '#2a9b98', '#1b5c63'],
  rose: ['#ffeaf2', '#ffadc9', '#ef6b98', '#b63b6c', '#6d2346'],
  violet: ['#f0e8ff', '#c4a8ff', '#8f6ef0', '#5f46b8', '#362b6e'],
  smoke: ['#f3f0ea', '#d0cac3', '#a49e99', '#78737b', '#4f4b58'],
  dust: ['#f0ddb9', '#ccaf83', '#9d8059', '#6e563a', '#4a3828'],
  water: ['#f2fbff', '#a3dcf4', '#5bafe0', '#3070b3', '#1f4581'],
  goo: ['#efffd2', '#c3ef84', '#82cc4f', '#4b8f3c', '#2c5a2f'],
  ember: ['#fffbe6', '#ffe489', '#ffab42', '#f0632e', '#a2301f']
};
const entries = [['ink', '#1c1826']];
for (const [k, r] of Object.entries(RAMPS)) r.forEach((hex, i) => entries.push([k + i, hex]));
const P = new Palette(entries);
const R = k => [0, 1, 2, 3, 4].map(i => P[k + i]);

/* ---------- primitives ---------- */
function star(r, cx, cy, s, ramp) {
  if (s <= 0) return;
  r.set(cx, cy, ramp[0]);
  for (let k = 1; k <= s; k++) {
    const c = k === 1 ? ramp[1] : k < s ? ramp[2] : ramp[3];
    r.set(cx + k, cy, c); r.set(cx - k, cy, c); r.set(cx, cy + k, c); r.set(cx, cy - k, c);
  }
  if (s >= 3) { r.set(cx + 1, cy + 1, ramp[2]); r.set(cx - 1, cy - 1, ramp[2]); r.set(cx + 1, cy - 1, ramp[2]); r.set(cx - 1, cy + 1, ramp[2]); }
}
function puff(r, cx, cy, rad, ramp, erode = 0, seed = 1) {
  for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy) / rad;
    if (d > 1) continue;
    if (erode > 0 && dither(x + seed, y, erode * (0.6 + d * 0.8))) continue;
    const l = (-dx - dy * 1.2) / rad;
    r.set(x, y, d > 0.82 && l < 0 ? ramp[3] : l > 0.55 ? ramp[0] : l > -0.1 ? ramp[1] : ramp[2]);
  }
}
function ringE(r, cx, cy, rx, ry, c, gaps = 0, seed = 0) {
  const n = Math.ceil(2 * Math.PI * Math.max(rx, ry) * 1.6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (gaps && ((Math.floor(a * gaps / Math.PI) + seed) % 2)) continue;
    r.set(Math.round(cx + Math.cos(a) * rx - 0.5), Math.round(cy + Math.sin(a) * ry - 0.5), c);
  }
}

/* ---------- effects ---------- */
function sparkle(f, ramp) {
  const r = new Raster(16, 16);
  const s = [1, 2, 3, 4, 3, 2][f];
  star(r, 7, 7, s, ramp);
  const s2 = [3, 2, 1, 0, 1, 2][f];
  if (s2) star(r, 12, 3, Math.min(2, s2), ramp);
  const s3 = [0, 1, 2, 1, 0, 1][f];
  if (s3) star(r, 3, 12, s3, ramp);
  return r;
}
function dustPuff(f, ramp) {
  const r = new Raster(32, 16);
  const t = f / 5;
  const puffs = [[-1, 0.9], [1, 0.9], [-0.5, 1.2], [0.5, 1.2]];
  puffs.forEach(([dir, sp], i) => {
    const cx = 16 + dir * (2 + t * 9 * sp), cy = 12 - t * 4 - (i > 1 ? 2 : 0);
    const rad = 1.6 + Math.sin(Math.min(1, t * 1.6) * Math.PI / 2) * 2.6 * (i > 1 ? 0.8 : 1);
    puff(r, cx, cy, rad * (t > 0.6 ? 1 - (t - 0.6) * 1.4 : 1), ramp, Math.max(0, t - 0.45) * 1.8, i * 3);
  });
  return r;
}
function smokePuff(f, ramp) {
  const r = new Raster(32, 32);
  const t = f / 7;
  const rng = mulberry32(9);
  const blobs = [];
  for (let i = 0; i < 6; i++) blobs.push([(rng() - 0.5) * 10, (rng() - 0.5) * 6, 3 + rng() * 2.5]);
  blobs.forEach(([ox, oy, rad], i) => {
    const grow = 0.75 + t * 1.15;
    puff(r, 16 + ox * (0.6 + t), 22 - t * 12 + oy * (0.6 + t * 0.5), rad * grow * (t > 0.7 ? 1 - (t - 0.7) * 1.6 : 1), ramp, Math.max(0, t - 0.4) * 1.5, i * 5);
  });
  return r;
}
function chimneySmoke(f, ramp) {
  const r = new Raster(16, 32);
  for (let k = 0; k < 4; k++) {
    const ph = ((f + k * 2) % 8) / 8;
    const cy = 29 - ph * 26, cx = 8 + Math.sin(ph * Math.PI * 2 + k) * 1.5 + ph * 2;
    puff(r, cx, cy, 1.4 + ph * 3.2, ramp, Math.max(0, ph - 0.55) * 2.2, k * 7);
  }
  return r;
}
function swirl(f, ramp) {
  const r = new Raster(32, 32);
  const n = 8, TAU = Math.PI * 2;
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * TAU;
    if (Math.floor(((a - f / n * TAU) % TAU + TAU) % TAU / (Math.PI / 3)) % 2) continue;
    r.set(Math.round(16 + Math.cos(a) * 12 - 0.5), Math.round(16 + Math.sin(a) * 7.5 - 0.5), ramp[3]);
  }
  for (let i = 0; i < 3; i++) {
    for (let tr = 7; tr >= 1; tr--) {
      const a = (f - tr * 0.22) / n * TAU + i * TAU / 3;
      r.set(Math.round(16 + Math.cos(a) * 9.5 - 0.5), Math.round(16 + Math.sin(a) * 6 - 0.5 - Math.sin(a * 2) * 0.8), tr < 3 ? ramp[1] : tr < 5 ? ramp[2] : ramp[3]);
    }
    const a = f / n * TAU + i * TAU / 3;
    const x = Math.round(16 + Math.cos(a) * 9.5 - 0.5), y = Math.round(16 + Math.sin(a) * 6 - 0.5 - Math.sin(a * 2) * 0.8);
    r.set(x, y, ramp[0]); r.set(x + 1, y, ramp[1]); r.set(x - 1, y, ramp[1]); r.set(x, y - 1, ramp[1]); r.set(x, y + 1, ramp[2]);
  }
  const k = f % 4;
  star(r, 15, 15, k === 1 || k === 3 ? 2 : 1, ramp);
  return r;
}
function pickup(f, ramp) {
  const r = new Raster(32, 32);
  const t = f / 5;
  const h = Math.round(4 + t * 22);
  if (t < 0.85) for (let y = 30 - h; y <= 29; y++) {
    const w = y < 30 - h + 3 ? 0 : 1;
    for (let x = 15 - w; x <= 16 + w; x++) r.set(x, y, x === 15 || x === 16 ? (t > 0.5 && (y % 2)) ? ramp[2] : ramp[1] : ramp[3]);
  }
  ringE(r, 16, 28, 3 + t * 11, 1.2 + t * 3.4, t > 0.6 ? ramp[3] : ramp[2], t > 0.5 ? 6 : 0, f);
  const rng = mulberry32(4);
  for (let i = 0; i < 6; i++) {
    const x = 10 + Math.floor(rng() * 12), y0 = 26 - Math.floor(rng() * 8);
    const y = Math.round(y0 - t * (12 + i * 2));
    if (y > 2 && (i + f) % 3 !== 0) star(r, x, y, t > 0.7 ? 0 : 1, ramp);
    else if (y > 2) r.set(x, y, ramp[2]);
  }
  if (f === 5) { r.d.fill(0); r.set(9, 6, ramp[2]); r.set(22, 8, ramp[3]); r.set(15, 3, ramp[2]); ringE(r, 16, 28, 14, 4.6, ramp[4], 8, 1); }
  return r;
}
function splash(f, ramp) {
  const r = new Raster(32, 32);
  const t = f / 6;
  const rng = mulberry32(21);
  for (let i = 0; i < 10; i++) {
    const vx = (rng() - 0.5) * 22, vy = -(14 + rng() * 14), tt = t * 1.1;
    const x = 16 + vx * tt, y = 26 + vy * tt + 34 * tt * tt;
    if (y > 28 || y < 0) continue;
    const big = i % 3 === 0 && t < 0.6;
    r.set(Math.round(x), Math.round(y), ramp[1]);
    if (big) { r.set(Math.round(x) + 1, Math.round(y), ramp[2]); r.set(Math.round(x), Math.round(y) + 1, ramp[2]); }
    else r.set(Math.round(x), Math.round(y) + 1, ramp[3]);
  }
  if (t < 0.5) for (let y = 26 - Math.round(Math.sin(t * Math.PI * 2) * 8); y <= 26; y++) { const w = (26 - y) * 0.3 + 1; for (let x = Math.round(16 - w); x <= 16 + w; x++) if (dither(x, y, 0.85)) r.set(x, y, y < 22 ? ramp[1] : ramp[2]); }
  ringE(r, 16, 27, 3 + t * 12, 1 + t * 3, t > 0.65 ? ramp[3] : ramp[2], t > 0.6 ? 5 : 0, f);
  if (t < 0.7) ringE(r, 16, 27, 1.5 + t * 6, 0.6 + t * 1.6, ramp[1]);
  if (f === 6) { r.d.fill(0); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; r.set(Math.round(16 + Math.cos(a) * 15 - 0.5), Math.round(27 + Math.sin(a) * 4.2 - 0.5), ramp[3]); } }
  return r;
}
function impact(f, ramp) {
  const r = new Raster(32, 32);
  const rays = 8;
  if (f === 0) { r.disc(16, 16, 3, ramp[1]); r.disc(16, 16, 1.6, ramp[0]); return r; }
  const len = [0, 13, 15, 14, 12][f], start = [0, 2, 6, 10, 11][f];
  for (let i = 0; i < rays; i++) {
    const a = i / rays * Math.PI * 2 + (i % 2 ? 0.2 : 0);
    const L = i % 2 ? len * 0.65 : len;
    for (let d = start; d <= L; d++) {
      if (f >= 3 && (d + i) % 3 === 0) continue;
      const x = Math.round(16 + Math.cos(a) * d - 0.5), y = Math.round(16 + Math.sin(a) * d - 0.5);
      r.set(x, y, d < L * 0.45 ? ramp[0] : d < L * 0.75 ? ramp[1] : ramp[2]);
    }
  }
  if (f === 1) { r.disc(16, 16, 5, ramp[1]); r.disc(16, 16, 3.5, ramp[0]); }
  if (f === 2) { ringE(r, 16, 16, 6, 6, ramp[1]); ringE(r, 16, 16, 5, 5, ramp[2]); r.disc(16, 16, 2, ramp[1]); }
  if (f === 3) ringE(r, 16, 16, 9, 9, ramp[3], 6, 0);
  if (f === 4) { r.d.fill(0); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.4; r.set(Math.round(16 + Math.cos(a) * 13), Math.round(16 + Math.sin(a) * 13), ramp[2]); } }
  return r;
}
function levelUp(f, ramp) {
  const r = new Raster(32, 48);
  const t = f / 9;
  const top = Math.round(44 - Math.min(1, t * 2.2) * 42);
  const fadeCol = t > 0.55;
  for (let y = top; y <= 44; y++) {
    const w = 2 + (y > 38 ? 1 : 0);
    for (let x = 16 - w; x < 16 + w; x++) {
      if (fadeCol && dither(x, y + f, (t - 0.55) * 2.4)) continue;
      const edge = x === 16 - w || x === 16 + w - 1;
      r.set(x, y, edge ? ramp[2] : (y - top < 3 ? ramp[0] : ramp[1]));
    }
  }
  for (let k = 0; k < 2; k++) {
    const tt = t - k * 0.25;
    if (tt <= 0 || tt > 0.85) continue;
    ringE(r, 16, 44, 4 + tt * 16, 1.5 + tt * 4, tt > 0.6 ? ramp[3] : ramp[1], tt > 0.5 ? 7 : 0, k);
  }
  const rng = mulberry32(31);
  for (let i = 0; i < 10; i++) {
    const x = 4 + Math.floor(rng() * 24), spd = 20 + rng() * 26, ph = rng() * 0.3;
    const y = Math.round(46 - (t - ph) * spd * 1.4);
    if (t < ph || y < 1 || y > 46) continue;
    if (i % 3 === 0 && t < 0.8) star(r, x, y, 1, ramp); else { r.set(x, y, ramp[1]); r.set(x, y + 1, ramp[3]); }
  }
  if (f >= 2 && f <= 5) star(r, 15, top + 1, f === 3 || f === 4 ? 3 : 2, ramp);
  if (f === 9) { r.d.fill(0); for (const [x, y] of [[8, 10], [24, 14], [12, 24], [20, 30], [15, 5]]) r.set(x, y, ramp[2]); }
  return r;
}

/* ---------- particles ---------- */
function dotP(size, ramp) {
  const r = new Raster(16, 16);
  if (size === 1) { r.set(7, 7, ramp[0]); r.set(8, 7, ramp[1]); r.set(7, 8, ramp[1]); r.set(8, 8, ramp[2]); return r; }
  puff(r, 8, 8, size === 2 ? 2.6 : 4.4, ramp);
  return r;
}
function leaf(f, ramp) {
  const r = new Raster(16, 16);
  const shapes = [
    ['..aab..', '.aabbc.', 'aabbcc.', '.bbcc..', '..c....'],
    ['...ab..', '..abc..', '..abc..', '..bc...', '..c....'],
    ['..cbb..', '.cbbaa.', '.ccbbaa', '..ccbb.', '....c..'],
    ['..ba...', '..cba..', '..cba..', '...cb..', '....c..']];
  r.pattern(5, 5 + [0, 1, 2, 1][f], shapes[f], { a: ramp[0], b: ramp[1], c: ramp[2] });
  return r;
}
function ember(f, ramp) {
  const r = new Raster(16, 16);
  const y = 9 - f;
  r.set(7, y, ramp[f % 2 ? 0 : 1]); r.set(8, y, ramp[2]); r.set(7, y + 1, ramp[2]); r.set(8, y + 1, ramp[3]);
  if (f % 2 === 0) r.set(7 + (f === 2 ? 1 : 0), y - 1, ramp[1]);
  r.set(7 + (f % 2), y + 3, ramp[3]);
  return r;
}
function bubble(f) {
  const r = new Raster(16, 16);
  const rx = [3, 3.4, 3, 2.6][f], ry = [3, 2.6, 3, 3.4][f];
  ringE(r, 8, 8 - f * 0.5, rx, ry, P.water2);
  r.set(6, Math.round(6 - f * 0.5), P.water0); r.set(7, Math.round(5 - f * 0.5), P.water1);
  return r;
}
function snowflake() {
  const r = new Raster(16, 16);
  const c = P.water0, d = P.water1;
  r.hline(4, 11, 8, c); r.vline(8, 4, 11, c); r.line(5, 5, 11, 11, d); r.line(11, 5, 5, 11, d); r.set(8, 8, P.water2);
  return r;
}
function streak(ramp) {
  const r = new Raster(16, 16);
  r.line(3, 12, 11, 4, ramp[2]); r.line(4, 12, 12, 4, ramp[1]); r.set(12, 4, ramp[0]); r.set(11, 5, ramp[0]);
  return r;
}
function diamond(ramp) {
  const r = new Raster(16, 16);
  r.poly([[8, 3], [12, 8], [8, 13], [4, 8]], ramp[1]); r.poly([[8, 3], [8, 8], [4, 8]], ramp[0]); r.poly([[12, 8], [8, 13], [8, 8]], ramp[2]);
  return r;
}
function ringP(ramp) { const r = new Raster(16, 16); ringE(r, 8, 8, 5, 5, ramp[1]); ringE(r, 8, 8, 4, 4, ramp[2]); r.set(5, 5, ramp[0]); return r; }

function build() {
  const pack = new Pack({ id: 'effects', name: 'Effects & Particles', code: 'FX', palette: P });
  pack.sheet('small', { name: 'Effects 16×16', cols: 20 });
  pack.sheet('large', { name: 'Effects 32×32 and up', cols: 20 });
  const fr = (n, fn) => Array.from({ length: n }, (_, f) => fn(f));
  const variants = [['gold', 'Gold'], ['teal', 'Teal'], ['rose', 'Rose']];
  for (const [k, n] of variants) pack.add('small', { id: `fx-sparkle-${k}`, name: `Sparkle (${n})`, category: 'Sparkles', frames: fr(6, f => sparkle(f, R(k))), duration: 90, tags: ['loop'] });
  pack.add('small', { id: 'fx-sparkle-violet', name: 'Sparkle (Violet)', category: 'Sparkles', frames: fr(6, f => sparkle(f, R('violet'))), duration: 90, tags: ['loop'] });
  pack.newRow('small');
  pack.add('small', { id: 'fx-leaf', name: 'Tumbling leaf', category: 'Particles', frames: fr(4, f => leaf(f, R('goo').slice(1))), duration: 140, tags: ['loop'] });
  pack.add('small', { id: 'fx-leaf-autumn', name: 'Tumbling leaf (autumn)', category: 'Particles', frames: fr(4, f => leaf(f, R('ember').slice(2))), duration: 140, tags: ['loop'] });
  pack.add('small', { id: 'fx-ember', name: 'Ember', category: 'Particles', frames: fr(4, f => ember(f, R('ember'))), duration: 110, tags: ['loop'] });
  pack.add('small', { id: 'fx-bubble', name: 'Bubble', category: 'Particles', frames: fr(4, bubble), duration: 160, tags: ['loop'] });
  pack.newRow('small');
  for (const [k, n] of [['gold', 'Gold'], ['teal', 'Teal'], ['rose', 'Rose'], ['violet', 'Violet']]) {
    pack.add('small', { id: `fx-dot-s-${k}`, name: `Dot small (${n})`, category: 'Particles', frames: [dotP(1, R(k))] });
    pack.add('small', { id: `fx-dot-m-${k}`, name: `Dot medium (${n})`, category: 'Particles', frames: [dotP(2, R(k))] });
    pack.add('small', { id: `fx-dot-l-${k}`, name: `Dot large (${n})`, category: 'Particles', frames: [dotP(3, R(k))] });
  }
  for (const [k, n] of [['gold', 'Gold'], ['teal', 'Teal']]) {
    pack.add('small', { id: `fx-streak-${k}`, name: `Spark streak (${n})`, category: 'Particles', frames: [streak(R(k))] });
    pack.add('small', { id: `fx-diamond-${k}`, name: `Glint diamond (${n})`, category: 'Particles', frames: [diamond(R(k))] });
    pack.add('small', { id: `fx-ring-${k}`, name: `Ring (${n})`, category: 'Particles', frames: [ringP(R(k))] });
  }
  pack.add('small', { id: 'fx-snowflake', name: 'Snowflake', category: 'Particles', frames: [snowflake()] });

  const L = 'large';
  for (const [k, n] of [['dust', 'Dust'], ['smoke', 'Ash']]) pack.add(L, { id: `fx-dust-${k}`, name: `Dust puff (${n})`, category: 'Dust', frames: fr(6, f => dustPuff(f, R(k))), duration: 80, loop: false, oneShot: 'fade' });
  pack.newRow(L);
  pack.add(L, { id: 'fx-smoke-puff', name: 'Smoke puff', category: 'Smoke', frames: fr(8, f => smokePuff(f, R('smoke'))), duration: 90, loop: false, oneShot: 'fade' });
  pack.add(L, { id: 'fx-smoke-plume', name: 'Rising smoke (loop)', category: 'Smoke', frames: fr(8, f => chimneySmoke(f, R('smoke'))), duration: 130 });
  pack.newRow(L);
  for (const [k, n] of [['teal', 'Teal'], ['violet', 'Violet'], ['rose', 'Rose']]) { pack.add(L, { id: `fx-swirl-${k}`, name: `Magic swirl (${n})`, category: 'Magic swirls', frames: fr(8, f => swirl(f, R(k))), duration: 90 }); pack.newRow(L); }
  for (const [k, n] of [['gold', 'Gold'], ['teal', 'Teal']]) { pack.add(L, { id: `fx-pickup-${k}`, name: `Item pickup (${n})`, category: 'Item pickups', frames: fr(6, f => pickup(f, R(k))), duration: 80, loop: false, oneShot: 'fade' }); }
  pack.newRow(L);
  for (const [k, n] of [['water', 'Water'], ['goo', 'Goo']]) { pack.add(L, { id: `fx-splash-${k}`, name: `Splash (${n})`, category: 'Splashes', frames: fr(7, f => splash(f, R(k))), duration: 70, loop: false, oneShot: 'fade' }); pack.newRow(L); }
  for (const [k, n] of [['ember', 'Fire'], ['teal', 'Teal'], ['rose', 'Rose']]) pack.add(L, { id: `fx-impact-${k}`, name: `Impact flash (${n})`, category: 'Impact flashes', frames: fr(5, f => impact(f, R(k))), duration: 60, loop: false, oneShot: 'fade' });
  pack.newRow(L);
  for (const [k, n] of [['gold', 'Gold'], ['teal', 'Teal']]) { pack.add(L, { id: `fx-levelup-${k}`, name: `Level-up burst (${n})`, category: 'Level-up bursts', frames: fr(10, f => levelUp(f, R(k))), duration: 75, loop: false, oneShot: 'fade' }); pack.newRow(L); }
  return pack;
}

module.exports = { build, palette: P };
