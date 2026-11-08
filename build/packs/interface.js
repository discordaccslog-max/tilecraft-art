'use strict';
const { Raster, Palette } = require('../lib/raster.js');
const { Pack } = require('../lib/pack.js');

const P = new Palette([
  ['out', '#120f1c'], ['white', '#fbf8f0'],
  ['d0', '#1b192b'], ['d1', '#27243c'], ['d2', '#38334f'], ['d3', '#4d4769'], ['d4', '#6b648a'], ['d5', '#958eb0'],
  ['y0', '#6b471f'], ['y1', '#a7732d'], ['y2', '#dbac4d'], ['y3', '#f6dc94'],
  ['v0', '#4a3323'], ['v1', '#7c593b'], ['v2', '#b8976b'], ['v3', '#ddc59b'], ['v4', '#efe0bf'], ['v5', '#fbf3df'],
  ['m0', '#1e2925'], ['m1', '#2e3e37'], ['m2', '#43574c'], ['m3', '#62786a'], ['m4', '#91a693'],
  ['c1', '#9b553a'], ['c2', '#d0875a'], ['c3', '#f0b98a'],
  ['h0', '#6b1e2b'], ['h1', '#b53343'], ['h2', '#e65f69'], ['h3', '#ffa5a3'],
  ['e0', '#154c5a'], ['e1', '#288d98'], ['e2', '#4ecec6'], ['e3', '#b4f4e8']
]);

const THEMES = {
  dusk: { name: 'Dusk', o: P.out, f: [P.d1, P.d2, P.d3, P.d4], t: [P.y0, P.y1, P.y2, P.y3], inset: [P.d0, P.d1], hi: P.d5, btn: [P.d2, P.d3, P.d4, P.d5], ink: P.y3 },
  vellum: { name: 'Vellum', o: P.v0, f: [P.v2, P.v3, P.v4, P.v5], t: [P.v0, P.v1, P.v2, P.v3], inset: [P.v2, P.v3], hi: P.white, btn: [P.v1, P.v2, P.v3, P.v4], ink: P.v0 },
  moss: { name: 'Moss', o: P.m0, f: [P.m1, P.m2, P.m3, P.m4], t: [P.c1, P.c1, P.c2, P.c3], inset: [P.m0, P.m1], hi: P.m4, btn: [P.m1, P.m2, P.m3, P.m4], ink: P.c3 }
};

/* rounded outline helper: skips the four corner pixels */
function frameRect(r, x0, y0, w, h, c, round = true) {
  for (let x = x0; x < x0 + w; x++) { if (!round || (x > x0 && x < x0 + w - 1)) { r.set(x, y0, c); r.set(x, y0 + h - 1, c); } }
  for (let y = y0; y < y0 + h; y++) { if (!round || (y > y0 && y < y0 + h - 1)) { r.set(x0, y, c); r.set(x0 + w - 1, y, c); } }
}
function fillRect(r, x0, y0, w, h, c) { r.rect(x0, y0, w, h, c); }

function panel(th, w = 48, h = 48, opt = {}) {
  const r = new Raster(w, h);
  fillRect(r, 1, 1, w - 2, h - 2, th.f[1]);
  frameRect(r, 0, 0, w, h, th.o);
  /* trim band */
  for (let k = 1; k <= 2; k++) {
    for (let x = k; x < w - k; x++) { r.set(x, k, k === 1 ? th.t[3] : th.t[2]); r.set(x, h - 1 - k, k === 1 ? th.t[0] : th.t[1]); }
    for (let y = k; y < h - k; y++) { r.set(k, y, k === 1 ? th.t[3] : th.t[2]); r.set(w - 1 - k, y, k === 1 ? th.t[0] : th.t[1]); }
  }
  frameRect(r, 3, 3, w - 6, h - 6, th.t[0], false);
  for (let x = 4; x < w - 4; x++) r.set(x, 4, th.f[2]);
  if (opt.title) {
    for (let y = 4; y < 12; y++) for (let x = 4; x < w - 4; x++) r.set(x, y, y === 4 ? th.f[3] : th.f[2]);
    for (let x = 4; x < w - 4; x++) r.set(x, 12, th.t[0]);
  }
  for (const [cx, cy] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) { r.set(cx, cy, th.t[3]); }
  if (opt.transparentCenter) for (let y = 5; y < h - 5; y++) for (let x = 5; x < w - 5; x++) r.set(x, y, 0);
  return r;
}
function framePiece(th) {
  const r = panel(th, 48, 48, { transparentCenter: true });
  /* corner flourishes */
  for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [47, 0, -1, 1], [0, 47, 1, -1], [47, 47, -1, -1]]) {
    r.set(cx + sx * 4, cy + sy * 4, th.t[3]); r.set(cx + sx * 5, cy + sy * 4, th.t[2]); r.set(cx + sx * 4, cy + sy * 5, th.t[2]);
  }
  for (let y = 5; y < 43; y++) { r.set(4, y, th.t[1]); r.set(43, y, th.t[1]); }
  for (let x = 5; x < 43; x++) { r.set(x, 4, th.t[2]); r.set(x, 43, th.t[0]); }
  return r;
}
function inset(th, w = 32, h = 32) {
  const r = new Raster(w, h);
  fillRect(r, 1, 1, w - 2, h - 2, th.inset[1]);
  frameRect(r, 0, 0, w, h, th.o);
  for (let x = 1; x < w - 1; x++) { r.set(x, 1, th.inset[0]); r.set(x, h - 2, th.f[2]); }
  for (let y = 1; y < h - 1; y++) { r.set(1, y, th.inset[0]); r.set(w - 2, y, th.f[2]); }
  r.set(1, 1, th.o);
  return r;
}
function slot(th, state) {
  const r = inset(th, 32, 32);
  if (state === 'hover') { frameRect(r, 0, 0, 32, 32, th.t[2]); for (let x = 2; x < 30; x++) r.set(x, 2, th.f[1]); }
  if (state === 'selected') {
    frameRect(r, 0, 0, 32, 32, th.t[3]);
    for (let k = 1; k <= 1; k++) frameRect(r, k, k, 32 - 2 * k, 32 - 2 * k, th.t[2], false);
    for (const [cx, cy, sx, sy] of [[2, 2, 1, 1], [29, 2, -1, 1], [2, 29, 1, -1], [29, 29, -1, -1]]) { r.set(cx, cy, th.t[3]); r.set(cx + sx, cy, th.t[3]); r.set(cx, cy + sy, th.t[3]); }
  }
  if (state === 'disabled') for (let y = 3; y < 29; y++) for (let x = 3; x < 29; x++) if ((x + y) % 4 === 0) r.set(x, y, th.inset[0]);
  return r;
}
function button(th, state, w = 48, h = 16) {
  const r = new Raster(w, h);
  const [sh, fill, light, hi] = th.btn;
  const pressed = state === 'pressed', hover = state === 'hover', dis = state === 'disabled';
  const top = pressed ? 1 : 0;
  const depth = pressed ? 1 : 2;
  const f = dis ? th.btn[1] : hover ? light : fill;
  for (let y = top; y < h; y++) for (let x = 0; x < w; x++) {
    let c = f;
    if (y >= h - depth - 1) c = dis ? th.btn[1] : sh;
    if (y === top + 1 && !pressed) c = dis ? th.btn[2] : hover ? hi : light;
    if (pressed && y === top + 1) c = sh;
    r.set(x, y, c);
  }
  frameRect(r, 0, top, w, h - top, th.o);
  if (!dis) for (let x = 2; x < w - 2; x++) r.set(x, h - depth - 1, hover ? th.t[2] : th.t[1]);
  if (hover) { r.set(1, top + 1, hi); r.set(w - 2, top + 1, hi); }
  return r;
}
function iconButton(th, state, glyph) {
  const r = button(th, state, 16, 16);
  if (glyph) { const dy = state === 'pressed' ? 1 : 0; glyph(r, dy, state === 'disabled' ? th.btn[2] : th.ink); }
  return r;
}
const glyphCross = (r, dy, c) => { for (let k = 0; k < 6; k++) { r.set(5 + k, 4 + k + dy, c); r.set(10 - k, 4 + k + dy, c); } };
function dialogue(th) {
  const r = new Raster(48, 48);
  fillRect(r, 1, 1, 46, 46, th.f[2]);
  frameRect(r, 0, 0, 48, 48, th.o);
  frameRect(r, 1, 1, 46, 46, th.t[2]);
  frameRect(r, 2, 2, 44, 44, th.o, false);
  for (let x = 3; x < 45; x++) r.set(x, 3, th.f[3]);
  for (let x = 3; x < 45; x++) r.set(x, 44, th.f[1]);
  return r;
}
function tail(th, side) {
  const r = new Raster(16, 16);
  for (let y = 0; y < 9; y++) {
    const x0 = 4, x1 = 12 - y;
    for (let x = x0; x <= x1; x++) r.set(x, y, x === x0 || x === x1 ? th.o : (y === 0 ? th.f[2] : th.f[2]));
  }
  for (let x = 4; x <= 12; x++) r.set(x, 0, x === 4 || x === 12 ? th.t[2] : th.f[2]);
  r.set(4, 0, th.t[2]); r.set(4, 9, th.o);
  return side === 'right' ? r.flipX() : r;
}
function nameplate(th) {
  const r = new Raster(48, 16);
  fillRect(r, 1, 2, 46, 12, th.t[1]);
  frameRect(r, 0, 1, 48, 14, th.o);
  for (let x = 2; x < 46; x++) { r.set(x, 3, th.t[3]); r.set(x, 12, th.t[0]); }
  for (let y = 4; y < 12; y++) for (let x = 2; x < 46; x++) r.set(x, y, th.t[2]);
  return r;
}
function barFrame(th) {
  const r = new Raster(48, 16);
  fillRect(r, 1, 4, 46, 8, th.inset[0]);
  frameRect(r, 0, 3, 48, 10, th.o);
  for (let x = 1; x < 47; x++) { r.set(x, 4, th.t[2]); r.set(x, 11, th.t[0]); }
  for (let y = 5; y < 11; y++) { r.set(1, y, th.t[1]); r.set(46, y, th.t[1]); }
  for (let y = 5; y < 11; y++) for (let x = 2; x < 46; x++) r.set(x, y, y === 5 ? P.out : th.inset[0]);
  return r;
}
function barFill(ramp, segmented) {
  const r = new Raster(48, 16);
  for (let y = 6; y <= 10; y++) for (let x = 2; x <= 45; x++) {
    if (segmented && x % 6 === 1) continue;
    r.set(x, y, y === 6 ? ramp[3] : y === 7 ? ramp[2] : y === 10 ? ramp[0] : ramp[1]);
  }
  return r;
}
function checkbox(th, on) {
  const r = new Raster(16, 16);
  fillRect(r, 3, 3, 10, 10, th.inset[1]); frameRect(r, 2, 2, 12, 12, th.o);
  r.hline(3, 12, 3, th.inset[0]); r.vline(3, 3, 12, th.inset[0]);
  if (on) { const c = th.ink; for (const [x, y] of [[5, 8], [6, 9], [7, 10], [8, 9], [9, 8], [10, 7], [11, 6], [5, 7], [6, 8], [7, 9], [8, 8], [9, 7], [10, 6]]) r.set(x, y, c); }
  return r;
}
function radio(th, on) {
  const r = new Raster(16, 16);
  r.disc(8, 8, 5.6, th.o); r.disc(8, 8, 4.6, th.inset[1]); r.set(5, 5, th.inset[0]); r.set(6, 4, th.inset[0]); r.set(4, 6, th.inset[0]);
  if (on) { r.disc(8, 8, 2.6, th.t[2]); r.set(7, 7, th.t[3]); }
  return r;
}
function toggle(th, on) {
  const r = new Raster(32, 16);
  fillRect(r, 2, 4, 28, 8, on ? th.t[1] : th.inset[0]); frameRect(r, 1, 3, 30, 10, th.o);
  const kx = on ? 18 : 2;
  fillRect(r, kx, 2, 12, 12, th.btn[2]); frameRect(r, kx, 2, 12, 12, th.o); r.hline(kx + 1, kx + 10, 3, th.btn[3]); r.hline(kx + 1, kx + 10, 12, th.btn[0]);
  return r;
}
function sliderTrack(th) {
  const r = new Raster(48, 16);
  fillRect(r, 1, 6, 46, 4, th.inset[0]); frameRect(r, 0, 5, 48, 6, th.o);
  r.hline(1, 46, 6, P.out);
  return r;
}
function knob(th, hover) {
  const r = new Raster(16, 16);
  r.disc(8, 8, 5.5, th.o); r.disc(8, 8, 4.5, hover ? th.t[3] : th.t[2]); r.disc(7, 7, 2, hover ? P.white : th.t[3]); r.set(10, 10, th.t[0]); r.set(11, 9, th.t[0]);
  return r;
}
function scrollTrack(th) {
  const r = new Raster(16, 48);
  fillRect(r, 5, 1, 6, 46, th.inset[0]); frameRect(r, 4, 0, 8, 48, th.o);
  return r;
}
function scrollThumb(th) {
  const r = new Raster(16, 32);
  fillRect(r, 4, 0, 8, 32, th.btn[2]); frameRect(r, 4, 0, 8, 32, th.o);
  r.vline(5, 1, 30, th.btn[3]); r.vline(10, 1, 30, th.btn[0]);
  for (const y of [14, 16, 18]) r.hline(6, 9, y, th.btn[0]);
  return r;
}
function tab(th, active) {
  const r = new Raster(48, 16);
  const top = active ? 0 : 2;
  fillRect(r, 1, top + 1, 46, 15 - top, active ? th.f[2] : th.f[1]);
  for (let x = 0; x < 48; x++) if (x > 0 && x < 47) r.set(x, top, th.o);
  for (let y = top + 1; y < 16; y++) { r.set(0, y, th.o); r.set(47, y, th.o); }
  r.hline(1, 46, top + 1, active ? th.t[2] : th.f[2]);
  if (!active) r.hline(0, 47, 15, th.o);
  return r;
}
function tooltip(th) {
  const r = new Raster(32, 32);
  fillRect(r, 1, 1, 30, 30, th.f[3]); frameRect(r, 0, 0, 32, 32, th.o);
  r.hline(1, 30, 1, th.hi); r.hline(1, 30, 30, th.f[1]);
  return r;
}
function arrowBob(th, f) {
  const r = new Raster(16, 16);
  const y0 = 5 + [0, 1, 2, 1][f];
  for (let k = 0; k < 4; k++) r.hline(4 + k, 11 - k, y0 + k, k === 0 ? th.t[3] : th.t[2]);
  r.outline(th.o);
  return r;
}

/* ---------- cursors & icons (white glyphs with dark outlines) ---------- */
function glyph(rows, fill = P.white, edge = P.out, extra = {}) {
  const r = new Raster(16, 16);
  r.pattern(0, 0, rows, Object.assign({ '#': fill, 'o': edge, 'g': P.y2, 'G': P.y1, 's': P.d4, 't': P.e2, 'r': P.h2 }, extra));
  return r;
}
const CURSORS = {
  arrow: { hot: [1, 1], rows: ['o...............', 'oo..............', 'o#o.............', 'o##o............', 'o###o...........', 'o####o..........', 'o#####o.........', 'o######o........', 'o#######o.......', 'o####oooo.......', 'o##o##o.........', 'o#o.o##o........', 'oo..o##o........', '.....o##o.......', '.....oooo.......', '................'] },
  'arrow-gold': { hot: [1, 1], rows: ['o...............', 'oo..............', 'ogo.............', 'oggo............', 'ogggo...........', 'oggggo..........', 'ogggggo.........', 'oggggGGo........', 'ogggGGGGo.......', 'oggGoooo........', 'ogGoGGo.........', 'oGo.oGGo........', 'oo..oGGo........', '.....oGGo.......', '.....oooo.......', '................'] },
  hand: { hot: [5, 1], rows: ['....oo..........', '...o##o.........', '...o##o.........', '...o##ooooo.....', '...o##o##o#oo...', '.ooo##o##o#o#o..', 'o##o########o#o.', 'o##o##########o.', '.o############o.', '.o###########o..', '..o##########o..', '..o#########o...', '...o########o...', '...o#######o....', '....ooooooo.....', '................'] },
  grab: { hot: [7, 6], rows: ['................', '................', '................', '.....oooooo.....', '....o#o##o#oo...', '...oo#o##o#o#o..', '..o#o########o..', '..o##########o..', '..o##########o..', '...o#########o..', '...o########o...', '....o#######o...', '....o#######o...', '.....ooooooo....', '................', '................'] },
  target: { hot: [7, 7], rows: ['.......o........', '.......#........', '.....oo#oo......', '....o..#..o.....', '...o...#...o....', '...o.......o....', 'oo###.....###oo.', '...o.......o....', '...o...#...o....', '....o..#..o.....', '.....oo#oo......', '.......#........', '.......o........', '................', '................', '................'] },
  text: { hot: [7, 7], rows: ['................', '....ooo.ooo.....', '....o##o##o.....', '.....oo#oo......', '......o#o.......', '......o#o.......', '......o#o.......', '......o#o.......', '......o#o.......', '......o#o.......', '......o#o.......', '.....oo#oo......', '....o##o##o.....', '....ooo.ooo.....', '................', '................'] },
  move: { hot: [7, 7], rows: ['.......o........', '......o#o.......', '.....o###o......', '....ooo#ooo.....', '...o..o#o..o....', '..o#ooo#ooo#o...', '.o###########o..', '..o#ooo#ooo#o...', '...o..o#o..o....', '....ooo#ooo.....', '.....o###o......', '......o#o.......', '.......o........', '................', '................', '................'] },
  'resize-h': { hot: [7, 7], rows: ['................', '................', '................', '................', '...o.......o....', '..oo.......oo...', '.o#ooooooooo#o..', 'o#############o.', '.o#ooooooooo#o..', '..oo.......oo...', '...o.......o....', '................', '................', '................', '................', '................'] },
  'resize-v': { hot: [7, 7], rows: ['.......o........', '......o#o.......', '.....o###o......', '....oooo#oooo...'.slice(0, 16), '.......o#o......'.slice(0, 16), '......o#o.......', '......o#o.......', '......o#o.......', '......o#o.......', '......o#o.......', '....ooo#ooo.....', '.....o###o......', '......o#o.......', '.......o........', '................', '................'] },
  forbidden: { hot: [7, 7], rows: ['................', '.....ooooo......', '...oorrrrroo....', '..orrooooorro...', '..orro....orro..', '.orro.....o#ro..', '.oro.....o#oro..', '.oro....o#o.ro..', '.oro...o#o..ro..', '.oro..o#o..oro..', '.orroo#o..orro..', '..orroooooorro..', '...oorrrrroo....', '.....ooooo......', '................', '................'] },
  help: { hot: [1, 1], rows: ['o...............', 'oo..............', 'o#o.............', 'o##o............', 'o###o...ooooo...', 'o####o.o#####o..', 'o#####oo#ooo#o..', 'o######ooo.o#o..', 'o####oooo.o##o..', 'o##o##o..o##o...', 'o#o.o##o.o#o....', 'oo..o##o.ooo....', '.....o##oo#o....', '.....ooooooo....', '................', '................'] }
};
function busy(f) {
  const r = new Raster(16, 16);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const x = Math.round(7.5 + Math.cos(a) * 4.6), y = Math.round(7.5 + Math.sin(a) * 4.6);
    const age = (i - f * 2 + 16) % 8;
    r.set(x, y, age < 2 ? P.white : age < 4 ? P.e2 : age < 6 ? P.e1 : P.d4);
  }
  r.outline(P.out);
  return r;
}
const ICONS = {
  check: ['................', '................', '...........oo...', '..........o##o..', '.........o##o...', '..oo....o##o....', '.o##o..o##o.....', '..o##oo##o......', '...o####o.......', '....o##o........', '.....oo.........', '................', '................', '................', '................', '................'],
  cross: ['................', '..oo......oo....', '.o##o....o##o...', '..o##o..o##o....', '...o##oo##o.....', '....o####o......', '....o####o......', '...o##oo##o.....', '..o##o..o##o....', '.o##o....o##o...', '..oo......oo....', '................', '................', '................', '................', '................'],
  plus: ['................', '......oooo......', '......o##o......', '......o##o......', '...oooo##oooo...', '...o########o...', '...o########o...', '...oooo##oooo...', '......o##o......', '......o##o......', '......oooo......', '................', '................', '................', '................', '................'],
  minus: ['................', '................', '................', '................', '...oooooooooo...', '...o########o...', '...o########o...', '...oooooooooo...', '................', '................', '................', '................', '................', '................', '................', '................'],
  'arrow-up': ['................', '.......oo.......', '......o##o......', '.....o####o.....', '....o######o....', '...oooo##oooo...', '......o##o......', '......o##o......', '......o##o......', '......oooo......', '................', '................', '................', '................', '................', '................'],
  menu: ['................', '................', '..oooooooooooo..', '..o##########o..', '..oooooooooooo..', '................', '..oooooooooooo..', '..o##########o..', '..oooooooooooo..', '................', '..oooooooooooo..', '..o##########o..', '..oooooooooooo..', '................', '................', '................'],
  search: ['................', '....oooo........', '...o####o.......', '..o#oooo#o......', '..o#o..o#o......', '..o#o..o#o......', '..o#oooo#o......', '...o####oo......', '....oooo##o.....', '.........o##o...', '..........o##o..', '...........oo...', '................', '................', '................', '................'],
  lock: ['................', '.....oooo.......', '....o####o......', '...o#oooo#o.....', '...o#o..o#o.....', '..oooooooooo....', '..ogggggGGGo....', '..oggggoGGGo....', '..ogggoooGGo....', '..oggggoGGGo....', '..oGGGGGGGGo....', '..oooooooooo....', '................', '................', '................', '................'],
  unlock: ['................', '.......oooo.....', '......o####o....', '.....o#oooo#o...', '.....o#o..o#o...', '..ooooooo.ooo...', '..ogggggGGGo....', '..oggggoGGGo....', '..ogggoooGGo....', '..oggggoGGGo....', '..oGGGGGGGGo....', '..oooooooooo....', '................', '................', '................', '................'],
  sound: ['................', '......oo........', '.....o#o...o....', '..ooo##o.o..o...', '..o####o..o.o...', '..o####o..o.o...', '..o####o..o.o...', '..ooo##o.o..o...', '.....o#o...o....', '......oo........', '................', '................', '................', '................', '................', '................'],
  mute: ['................', '......oo........', '.....o#o........', '..ooo##o.o...o..', '..o####o..o.o...', '..o####o...o....', '..o####o..o.o...', '..ooo##o.o...o..', '.....o#o........', '......oo........', '................', '................', '................', '................', '................', '................'],
  info: ['................', '....oooooo......', '...o######o.....', '..o####oo##o....', '..o########o....', '..o###ooo##o....', '..o####o###o....', '..o####o###o....', '..o###ooo##o....', '...o######o.....', '....oooooo......', '................', '................', '................', '................', '................'],
  warning: ['................', '.......oo.......', '......ogGo......', '.....oggGGo.....', '.....ogoogo.....', '....oggooGGo....', '....oggooGGo....', '...ogggggGGGo...', '...oggGooGGGo...', '..oggggggGGGGo..', '..oooooooooooo..', '................', '................', '................', '................', '................'],
  star: ['................', '.......oo.......', '......ogGo......', '......ogGo......', '.ooooogggGooooo.', '.oggggggggGGGGo.', '..ogggggggGGGo..', '...ogggggGGGo...', '...ogggoGGGGo...', '..oggGo..oGGGo..', '..ooo......ooo..', '................', '................', '................', '................', '................'],
  gear: ['................', '......oooo......', '...oo.o##o.oo...', '..o##oo##oo##o..', '..o##########o..', '...o###oo###o...', '.ooo##o..o##ooo.', '.o###o....o###o.', '.o###o....o###o.', '.ooo##o..o##ooo.', '...o###oo###o...', '..o##########o..', '..o##oo##oo##o..', '...oo.o##o.oo...', '......oooo......', '................'],
  home: ['................', '.......oo.......', '......o##o......', '.....o####o.....', '....o######o....', '...o########o...', '..oo########oo..', '....o##oo##o....', '....o##oo##o....', '....o##oo##o....', '....oooooooo....', '................', '................', '................', '................', '................']
};

function build() {
  const pack = new Pack({ id: 'interface', name: 'Interface Essentials', code: 'UX', palette: P });
  pack.sheet('ui', { name: 'Interface pieces', cols: 24 });
  pack.sheet('glyphs', { name: 'Cursors and icons', cols: 16 });
  const S = 'ui';
  const ns = (l, t, r, b) => ({ nineSlice: [l, t, r, b] });
  for (const [tk, th] of Object.entries(THEMES)) {
    pack.newRow(S);
    const id = s => `ui-${tk}-${s}`, nm = s => `${s} (${th.name})`;
    pack.add(S, { id: id('panel'), name: nm('Panel'), category: 'Panels & windows', frames: [panel(th)], meta: ns(6, 6, 6, 6), tags: [tk, 'nine-slice'] });
    pack.add(S, { id: id('window'), name: nm('Window'), category: 'Panels & windows', frames: [panel(th, 48, 48, { title: true })], meta: ns(6, 14, 6, 6), tags: [tk, 'nine-slice'] });
    pack.add(S, { id: id('frame'), name: nm('Frame'), category: 'Frames', frames: [framePiece(th)], meta: ns(7, 7, 7, 7), tags: [tk, 'nine-slice'] });
    pack.add(S, { id: id('dialogue'), name: nm('Dialogue box'), category: 'Dialogue', frames: [dialogue(th)], meta: ns(5, 5, 5, 5), tags: [tk, 'nine-slice'] });
    pack.add(S, { id: id('inset'), name: nm('Inset well'), category: 'Panels & windows', frames: [inset(th)], meta: ns(3, 3, 3, 3), tags: [tk, 'nine-slice'] });
    pack.add(S, { id: id('tooltip'), name: nm('Tooltip'), category: 'Panels & windows', frames: [tooltip(th)], meta: ns(3, 3, 3, 3), tags: [tk, 'nine-slice'] });
    for (const st of ['normal', 'hover', 'selected', 'disabled']) pack.add(S, { id: id(`slot-${st}`), name: nm(`Inventory slot ${st}`), category: 'Inventory slots', frames: [slot(th, st)], meta: ns(5, 5, 5, 5), tags: [tk, 'nine-slice', st] });
    for (const st of ['normal', 'hover', 'pressed', 'disabled']) pack.add(S, { id: id(`button-${st}`), name: nm(`Button ${st}`), category: 'Buttons', frames: [button(th, st)], meta: ns(5, 5, 5, 6), tags: [tk, 'nine-slice', st] });
    pack.add(S, { id: id('nameplate'), name: nm('Name plate'), category: 'Dialogue', frames: [nameplate(th)], meta: ns(5, 4, 5, 4), tags: [tk, 'nine-slice'] });
    pack.add(S, { id: id('bar-frame'), name: nm('Bar frame'), category: 'Bars', frames: [barFrame(th)], meta: ns(3, 4, 3, 4), tags: [tk, 'nine-slice'] });
    for (const a of [true, false]) pack.add(S, { id: id(`tab-${a ? 'active' : 'inactive'}`), name: nm(`Tab ${a ? 'active' : 'inactive'}`), category: 'Tabs', frames: [tab(th, a)], meta: ns(4, 4, 4, 2), tags: [tk, 'nine-slice'] });
    pack.add(S, { id: id('slider-track'), name: nm('Slider track'), category: 'Sliders & toggles', frames: [sliderTrack(th)], meta: ns(3, 5, 3, 5), tags: [tk, 'nine-slice'] });
    pack.add(S, { id: id('scroll-track'), name: nm('Scrollbar track'), category: 'Sliders & toggles', frames: [scrollTrack(th)], meta: ns(4, 3, 4, 3), tags: [tk, 'nine-slice'] });
    pack.add(S, { id: id('scroll-thumb'), name: nm('Scrollbar thumb'), category: 'Sliders & toggles', frames: [scrollThumb(th)], meta: ns(4, 3, 4, 3), tags: [tk, 'nine-slice'] });
    for (const t of [false, true]) pack.add(S, { id: id(`toggle-${t ? 'on' : 'off'}`), name: nm(`Toggle ${t ? 'on' : 'off'}`), category: 'Sliders & toggles', frames: [toggle(th, t)], tags: [tk] });
    for (const st of ['normal', 'hover', 'pressed']) pack.add(S, { id: id(`close-${st}`), name: nm(`Close button ${st}`), category: 'Buttons', frames: [iconButton(th, st, glyphCross)], tags: [tk, st] });
    for (const st of ['normal', 'hover', 'pressed']) pack.add(S, { id: id(`square-${st}`), name: nm(`Square button ${st}`), category: 'Buttons', frames: [iconButton(th, st)], meta: ns(3, 3, 3, 4), tags: [tk, 'nine-slice', st] });
    for (const t of [false, true]) pack.add(S, { id: id(`checkbox-${t ? 'on' : 'off'}`), name: nm(`Checkbox ${t ? 'checked' : 'empty'}`), category: 'Sliders & toggles', frames: [checkbox(th, t)], tags: [tk] });
    for (const t of [false, true]) pack.add(S, { id: id(`radio-${t ? 'on' : 'off'}`), name: nm(`Radio ${t ? 'selected' : 'empty'}`), category: 'Sliders & toggles', frames: [radio(th, t)], tags: [tk] });
    for (const h of [false, true]) pack.add(S, { id: id(`knob-${h ? 'hover' : 'normal'}`), name: nm(`Slider knob ${h ? 'hover' : 'normal'}`), category: 'Sliders & toggles', frames: [knob(th, h)], tags: [tk] });
    pack.add(S, { id: id('tail-left'), name: nm('Speech tail left'), category: 'Dialogue', frames: [tail(th, 'left')], tags: [tk] });
    pack.add(S, { id: id('tail-right'), name: nm('Speech tail right'), category: 'Dialogue', frames: [tail(th, 'right')], tags: [tk] });
    pack.add(S, { id: id('continue'), name: nm('Continue arrow'), category: 'Dialogue', frames: [0, 1, 2, 3].map(f => arrowBob(th, f)), duration: 140, tags: [tk, 'animated'] });
  }
  pack.newRow(S);
  for (const [k, n, ramp] of [['health', 'Health', [P.h0, P.h1, P.h2, P.h3]], ['energy', 'Energy', [P.e0, P.e1, P.e2, P.e3]], ['xp', 'Experience', [P.y0, P.y1, P.y2, P.y3]]]) {
    pack.add(S, { id: `ui-bar-${k}`, name: `${n} fill`, category: 'Bars', frames: [barFill(ramp, false)], meta: ns(2, 6, 2, 5), tags: ['nine-slice'] });
    pack.add(S, { id: `ui-bar-${k}-segmented`, name: `${n} fill (segmented)`, category: 'Bars', frames: [barFill(ramp, true)], tags: [] });
  }
  for (const [k, def] of Object.entries(CURSORS)) pack.add('glyphs', { id: `ui-cursor-${k}`, name: `Cursor ${k.replace('-', ' ')}`, category: 'Cursors', frames: [glyph(def.rows)], meta: { hotspot: def.hot } });
  pack.add('glyphs', { id: 'ui-cursor-busy', name: 'Cursor busy', category: 'Cursors', frames: [0, 1, 2, 3].map(busy), duration: 120, meta: { hotspot: [7, 7] } });
  pack.newRow('glyphs');
  for (const [k, rows] of Object.entries(ICONS)) pack.add('glyphs', { id: `ui-icon-${k}`, name: `Icon ${k.replace('-', ' ')}`, category: 'Icons', frames: [glyph(rows)] });
  const up = glyph(ICONS['arrow-up']);
  const rot = (r, k) => { let o = r; for (let i = 0; i < k; i++) { const n = new Raster(16, 16); o.each((x, y, v) => { if (v) n.set(15 - y, x, v); }); o = n; } return o; };
  pack.add('glyphs', { id: 'ui-icon-arrow-right', name: 'Icon arrow right', category: 'Icons', frames: [rot(up, 1)] });
  pack.add('glyphs', { id: 'ui-icon-arrow-down', name: 'Icon arrow down', category: 'Icons', frames: [rot(up, 2)] });
  pack.add('glyphs', { id: 'ui-icon-arrow-left', name: 'Icon arrow left', category: 'Icons', frames: [rot(up, 3)] });
  return pack;
}

module.exports = { build, palette: P };
