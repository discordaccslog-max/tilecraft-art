'use strict';
/* Layered character figure. A pose produces a label map (which body part each pixel
 * belongs to, plus a light/mid/dark shade). Bodies, outfits, hair and accessories are
 * all painted from the same label map, so every layer lines up in every frame.
 * Frame: 16×32, feet on row 30. Directions: down, left, right (mirrored left), up. */
const { Raster } = require('./raster.js');

const FW = 16, FH = 32;
const L = { OUT: 1, HEAD: 2, EYE: 3, BLUSH: 4, TORSO: 5, ARM: 6, HAND: 7, THIGH: 8, SHIN: 9, FOOT: 10, FARARM: 11, FARHAND: 12, FARLEG: 13, FARFOOT: 14 };
const DIRS = ['down', 'left', 'right', 'up'];
const ANIMS = { walk: { frames: 4, durations: [140, 140, 140, 140] }, idle: { frames: 2, durations: [520, 520] } };

const HEAD_FRONT = [
  '.....######.....',
  '....########....',
  '...##########...',
  '...##########...',
  '...##########...',
  '...##########...',
  '...##########...',
  '....########....',
  '.....######.....'];
const HEAD_SIDE = [
  '.....#####......',
  '....#######.....',
  '...#########....',
  '...#########....',
  '...#########....',
  '...#########....',
  '....########....',
  '....#######.....',
  '.....#####......'];

function pose(anim, f) {
  if (anim === 'walk') return { bob: [0, 1, 0, 1][f], step: [0, 1, 0, -1][f], stride: [1, 0, -1, 0][f] };
  return { bob: [0, -1][f], step: 0, stride: 0 };
}

class Figure {
  constructor() { this.lab = new Uint8Array(FW * FH); this.sh = new Uint8Array(FW * FH); this.part = new Uint8Array(FW * FH); }
  set(x, y, l, s = 1) { if (x < 0 || y < 0 || x >= FW || y >= FH) return; this.lab[y * FW + x] = l; this.sh[y * FW + x] = s; }
  get(x, y) { return (x < 0 || y < 0 || x >= FW || y >= FH) ? 0 : this.lab[y * FW + x]; }
  shade(x, y) { return this.sh[y * FW + x]; }
  rect(x0, y0, x1, y1, l, shadeFn) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, l, shadeFn ? shadeFn(x, y, x0, x1, y0, y1) : 1); }
}
const sideShade = (x, y, x0, x1) => { const w = x1 - x0; if (w <= 0) return 1; const r = (x - x0) / w; return r < 0.3 ? 0 : r > 0.72 ? 2 : 1; };

/* build: 'slim' | 'sturdy' */
function figure(dir, anim, f, build) {
  const fig = new Figure();
  const p = pose(anim, f);
  const dy = -p.bob;
  const wide = build === 'sturdy';
  if (dir === 'down' || dir === 'up') {
    const tx0 = wide ? 4 : 5, tx1 = wide ? 11 : 10;
    const aL = wide ? [1, 2] : [2, 3], aR = wide ? [13, 14] : [12, 13];
    /* legs */
    const legs = [[wide ? 4 : 5, 7, p.step > 0 ? 1 : 0], [8, wide ? 11 : 10, p.step < 0 ? 1 : 0]];
    for (const [x0, x1, lift] of legs) {
      const top = 23 + dy, bot = 28 - lift;
      for (let y = top; y <= bot; y++) for (let x = x0; x <= x1; x++) fig.set(x, y, y <= 24 + dy ? L.THIGH : L.SHIN, x === x0 ? 0 : x === x1 ? 2 : 1);
      for (let y = 29 - lift; y <= 30 - lift; y++) for (let x = x0 - (x0 < 8 ? 1 : 0); x <= x1 + (x1 > 8 ? 1 : 0); x++) fig.set(x, y, L.FOOT, y === 29 - lift ? 0 : 2);
    }
    /* torso */
    fig.rect(tx0, 16 + dy, tx1, 22 + dy, L.TORSO, (x, y) => (y === 16 + dy && dir === 'down') ? 2 : sideShade(x, y, tx0, tx1));
    /* arms: the arm opposite the lifted leg swings forward and looks 1px longer */
    for (const [[x0, x1], fwd, light] of [[aL, p.step < 0, 0], [aR, p.step > 0, 2]]) {
      const end = 21 + dy + (fwd ? 1 : 0);
      for (let y = 16 + dy; y <= end - 1; y++) for (let x = x0; x <= x1; x++) fig.set(x, y, L.ARM, x === x0 ? Math.min(light, 1) : light === 2 ? 2 : 1);
      for (let x = x0; x <= x1; x++) fig.set(x, end, L.HAND, light ? 1 : 0), fig.set(x, end + 1, L.HAND, 2);
    }
    /* head */
    HEAD_FRONT.forEach((row, j) => { for (let i = 0; i < FW; i++) if (row[i] === '#') fig.set(i, 7 + j + dy, L.HEAD, i <= 4 ? 0 : i >= 11 ? 2 : (j >= 7 ? 2 : 1)); });
    if (dir === 'down') {
      for (const ex of [5, 10]) { fig.set(ex, 12 + dy, L.EYE); fig.set(ex, 13 + dy, L.EYE); }
      fig.set(4, 14 + dy, L.BLUSH); fig.set(11, 14 + dy, L.BLUSH);
    }
  } else {
    const tx0 = wide ? 5 : 6, tx1 = wide ? 10 : 10;
    /* far side first (drawn behind) */
    const legPos = s => ({ near: -2 * s, far: 2 * s });
    const lp = legPos(p.stride);
    const drawLeg = (offset, lab, footLab) => {
      const hip = 7 + (wide ? 0 : 0), top = 23 + dy;
      for (let y = top; y <= 28; y++) {
        const t = (y - top) / (28 - top);
        const cx = hip + Math.round(offset * t);
        for (let x = cx; x <= cx + 2; x++) fig.set(x, y, lab === L.FARLEG ? L.FARLEG : (y <= 24 + dy ? L.THIGH : L.SHIN), lab === L.FARLEG ? 2 : x === cx ? 0 : x === cx + 2 ? 2 : 1);
      }
      const fx = hip + offset;
      for (let y = 29; y <= 30; y++) for (let x = fx - 1; x <= fx + 2; x++) fig.set(x, y, footLab, lab === L.FARLEG ? 2 : y === 29 ? 0 : 2);
    };
    const armSwing = p.stride * -2;
    const drawArm = (sw, lab, handLab) => {
      const sx = 8, sy = 16 + dy;
      for (let k = 0; k <= 5; k++) {
        const t = k / 5; const x = sx + Math.round(sw * t), y = sy + k;
        fig.set(x, y, lab, lab === L.FARARM ? 2 : 1); fig.set(x + 1, y, lab, 2);
      }
      const hx = sx + sw, hy = sy + 6;
      fig.set(hx, hy, handLab, lab === L.FARARM ? 2 : 0); fig.set(hx + 1, hy, handLab, 2);
    };
    drawLeg(lp.far, L.FARLEG, L.FARFOOT);
    drawArm(-armSwing, L.FARARM, L.FARHAND);
    fig.rect(tx0, 16 + dy, tx1, 22 + dy, L.TORSO, (x, y) => sideShade(x, y, tx0, tx1));
    drawLeg(lp.near, L.THIGH, L.FOOT);
    HEAD_SIDE.forEach((row, j) => { for (let i = 0; i < FW; i++) if (row[i] === '#') fig.set(i, 7 + j + dy, L.HEAD, i <= 5 ? 0 : i >= 10 ? 2 : (j >= 7 ? 2 : 1)); });
    fig.set(5, 12 + dy, L.EYE); fig.set(5, 13 + dy, L.EYE);
    fig.set(4, 14 + dy, L.BLUSH);
    drawArm(armSwing, L.ARM, L.HAND);
  }
  /* silhouette outline */
  const solid = fig.lab.slice();
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    if (solid[y * FW + x]) continue;
    const n = (i, j) => i >= 0 && j >= 0 && i < FW && j < FH && solid[j * FW + i];
    if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) fig.set(x, y, L.OUT, 1);
  }
  fig.dy = dy; fig.dir = dir; fig.pose = p;
  return fig;
}

/* Paint helper: maps (label, shade, x, y) to an ink (or 0). */
function paint(fig, fn) {
  const r = new Raster(FW, FH);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const l = fig.lab[y * FW + x];
    const c = fn(l, fig.sh[y * FW + x], x, y, fig);
    if (c) r.set(x, y, c);
  }
  return r;
}

/* Frames for one layer: returns {down:{walk:[...],idle:[...]}, ...}. draw(dir, fig, anim, f) → Raster. */
function layerFrames(build, draw) {
  const out = {};
  for (const dir of ['down', 'left', 'up']) {
    out[dir] = {};
    for (const anim of Object.keys(ANIMS)) {
      out[dir][anim] = [];
      for (let f = 0; f < ANIMS[anim].frames; f++) out[dir][anim].push(draw(dir, figure(dir, anim, f, build), anim, f));
    }
  }
  out.right = {};
  for (const anim of Object.keys(ANIMS)) out.right[anim] = out.left[anim].map(r => r.flipX());
  return out;
}

module.exports = { FW, FH, L, DIRS, ANIMS, figure, paint, layerFrames, pose };
