'use strict';
/* Autotile renderers and their seam checks.
 *
 * A blob47 tile is drawn by a painter function evaluated on a pixel mask. The mask
 * is built per quadrant from the cell's neighbours, using edge offsets that are
 * periodic in world space, so the mask (and any painter that only uses world-periodic
 * textures) is identical whether it is evaluated inside one tile or across a whole map.
 * checkBlob() proves that: every tile is compared pixel for pixel with a global render
 * of the same neighbourhood inside random 5×5 worlds, for all 256 neighbourhoods. */

const AT = require('../../js/autotile.js');
const { Raster, mulberry32, mod } = require('./raster.js');

const T = 16;
const zero = () => 0;

function shape(o = {}) {
  return {
    top: o.top ?? 3, bottom: o.bottom ?? 3, left: o.left ?? 3, right: o.right ?? 3,
    wobTop: o.wobTop || zero, wobBottom: o.wobBottom || zero, wobLeft: o.wobLeft || zero, wobRight: o.wobRight || zero,
    outer: o.outer ?? 4, inner: o.inner ?? 3
  };
}

function quadInside(lx, ly, nb, s) {
  const west = lx < 8, north = ly < 8;
  const h = north ? nb.N : nb.S;
  const v = west ? nb.W : nb.E;
  const d = north ? (west ? nb.NW : nb.NE) : (west ? nb.SW : nb.SE);
  if (h && v && d) return true;
  const dv = north ? ly : T - 1 - ly;
  const dh = west ? lx : T - 1 - lx;
  const Th = north ? s.top + s.wobTop(lx) : s.bottom + s.wobBottom(lx);
  const Tv = west ? s.left + s.wobLeft(ly) : s.right + s.wobRight(ly);
  if (h && v) {
    if (dv >= Th || dh >= Tv) return true;
    const a = Th - 1 - dv, b = Tv - 1 - dh, R = s.inner;
    if (a < R && b < R) return Math.hypot(a + 0.5 - R, b + 0.5 - R) > R;
    return false;
  }
  if (h) return dh >= Tv;
  if (v) return dv >= Th;
  if (dv < Th || dh < Tv) return false;
  const a = dv - Th, b = dh - Tv, R = s.outer;
  if (a < R && b < R) return Math.hypot(a + 0.5 - R, b + 0.5 - R) <= R;
  return true;
}

/* q exposes the mask to painters. Coordinates are pixels in tile-local or world space. */
function makeQuery(occ, s) {
  const memo = new Map();
  function inside(x, y) {
    const key = x * 100003 + y;
    let v = memo.get(key);
    if (v !== undefined) return v;
    const cx = Math.floor(x / T), cy = Math.floor(y / T);
    if (!occ(cx, cy)) v = false;
    else {
      const nb = {
        N: occ(cx, cy - 1), NE: occ(cx + 1, cy - 1), E: occ(cx + 1, cy), SE: occ(cx + 1, cy + 1),
        S: occ(cx, cy + 1), SW: occ(cx - 1, cy + 1), W: occ(cx - 1, cy), NW: occ(cx - 1, cy - 1)
      };
      v = quadInside(x - cx * T, y - cy * T, nb, s);
    }
    memo.set(key, v);
    return v;
  }
  function scan(x, y, dx, dy, max = 4) {
    let n = 0;
    while (n < max && inside(x + dx * (n + 1), y + dy * (n + 1))) n++;
    return n;
  }
  /* edge distances in the four directions plus an 8-neighbour ring flag */
  function probe(x, y, max = 4) {
    const r = { up: scan(x, y, 0, -1, max), down: scan(x, y, 0, 1, max), left: scan(x, y, -1, 0, max), right: scan(x, y, 1, 0, max) };
    r.min = Math.min(r.up, r.down, r.left, r.right);
    r.ring = !(inside(x - 1, y - 1) && inside(x + 1, y - 1) && inside(x - 1, y + 1) && inside(x + 1, y + 1)) || r.min === 0;
    return r;
  }
  const cell = (x, y) => occ(Math.floor(x / T), Math.floor(y / T));
  return { inside, scan, probe, occ, cell };
}

const OFFS = { [AT.N]: [0, -1], [AT.NE]: [1, -1], [AT.E]: [1, 0], [AT.SE]: [1, 1], [AT.S]: [0, 1], [AT.SW]: [-1, 1], [AT.W]: [-1, 0], [AT.NW]: [-1, -1] };
function localOcc(mask) {
  return (cx, cy) => {
    if (cx === 0 && cy === 0) return true;
    if (Math.abs(cx) > 1 || Math.abs(cy) > 1) return false;
    for (const bit in OFFS) if (OFFS[bit][0] === cx && OFFS[bit][1] === cy) return !!(mask & bit);
    return false;
  };
}

/* Renders all 47 tiles for one frame. painter(x, y, q, frame) returns an ink id. */
function renderBlob(s, painter, frame = 0) {
  return AT.BLOB47.map(mask => {
    const q = makeQuery(localOcc(mask), s);
    return Raster.from(T, T, (x, y) => painter(x, y, q, frame));
  });
}

function checkBlob(name, s, painter, tilesByFrame, opts = {}) {
  const errors = [];
  const rand = mulberry32(opts.seed || 7);
  const K = opts.contexts || 6;
  let compared = 0;
  tilesByFrame.forEach((tiles, frame) => {
    for (let m = 0; m < 256; m++) for (let k = 0; k < K; k++) {
      const g = new Uint8Array(25);
      for (let i = 0; i < 25; i++) g[i] = rand() < 0.55 ? 1 : 0;
      g[12] = 1;
      for (const bit in OFFS) { const [dx, dy] = OFFS[bit]; g[(2 + dy) * 5 + 2 + dx] = (m & bit) ? 1 : 0; }
      /* the 5×5 world sits at cells (7..11, 3..7) so x and y offsets differ: any pattern that is not 16-periodic on both axes fails */
      const OX = 7, OY = 3;
      const occ = (cx, cy) => { cx -= OX; cy -= OY; return (cx < 0 || cy < 0 || cx > 4 || cy > 4) ? (rand() < 0.5) : !!g[cy * 5 + cx]; };
      const memo = new Map();
      const occStable = (cx, cy) => { const key = cx + ',' + cy; if (!memo.has(key)) memo.set(key, occ(cx, cy)); return memo.get(key); };
      const q = makeQuery(occStable, s);
      const tile = tiles[AT.BLOB_INDEX[m]];
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const g0 = painter((OX + 2) * T + x, (OY + 2) * T + y, q, frame);
        compared++;
        if (g0 !== tile.get(x, y)) { errors.push(`${name}: tile mask ${m} frame ${frame} pixel ${x},${y} differs from its neighbours`); return; }
      }
      /* empty neighbour cells must stay untouched by this terrain */
      if (k === 0) {
        const g2 = g.slice(); g2[12] = 0;
        const q2 = makeQuery((cx, cy) => { cx -= OX; cy -= OY; return (cx < 0 || cy < 0 || cx > 4 || cy > 4) ? false : !!g2[cy * 5 + cx]; }, s);
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
          if (painter((OX + 2) * T + x, (OY + 2) * T + y, q2, frame) !== (opts.emptyInk || 0)) { errors.push(`${name}: terrain leaks into an empty cell (mask ${m})`); return; }
        }
      }
      if (errors.length > 4) return;
    }
  });
  return { errors, compared };
}

/* edge16: painter(x, y, mask, frame) draws a tile whose arms reach the sides in `mask`. */
function renderEdge(painter, frame = 0) {
  const out = [];
  for (let m = 0; m < 16; m++) out.push(Raster.from(T, T, (x, y) => painter(x, y, m, frame)));
  return out;
}
function checkEdge(name, tilesByFrame) {
  const errors = []; let compared = 0;
  tilesByFrame.forEach((tiles, f) => {
    for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) {
      if ((a & 2) && (b & 8)) for (let y = 0; y < T; y++) {
        compared++;
        if (!!tiles[a].get(T - 1, y) !== !!tiles[b].get(0, y)) { errors.push(`${name}: tiles ${a}|${b} frame ${f} do not join at row ${y}`); break; }
      }
      if ((a & 4) && (b & 1)) for (let x = 0; x < T; x++) {
        compared++;
        if (!!tiles[a].get(x, T - 1) !== !!tiles[b].get(x, 0)) { errors.push(`${name}: tiles ${a}/${b} frame ${f} do not join at column ${x}`); break; }
      }
    }
    /* a side without a connection must not touch the tile border */
    for (let a = 0; a < 16; a++) for (let i = 0; i < T; i++) {
      const t = tiles[a];
      if ((!(a & 1) && t.get(i, 0)) || (!(a & 4) && t.get(i, T - 1)) || (!(a & 8) && t.get(0, i)) || (!(a & 2) && t.get(T - 1, i))) {
        errors.push(`${name}: tile ${a} frame ${f} touches a side it does not connect to`); break;
      }
    }
  });
  return { errors, compared };
}

/* Periodic seam heuristic for opaque fill tiles: the colour step across the wrap-around
 * seam must not stand out against the steps inside the tile. */
function seamRatio(rasterA, rasterB, rgba, axis = 'x') {
  const dist = (p, q) => { const a = rgba(p), b = rgba(q); return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); };
  let inner = 0, n = 0, seam = 0;
  for (let i = 0; i < T; i++) {
    for (let j = 0; j < T - 1; j++) {
      inner += axis === 'x' ? dist(rasterA.get(j, i), rasterA.get(j + 1, i)) : dist(rasterA.get(i, j), rasterA.get(i, j + 1));
      n++;
    }
    seam += axis === 'x' ? dist(rasterA.get(T - 1, i), rasterB.get(0, i)) : dist(rasterA.get(i, T - 1), rasterB.get(i, 0));
  }
  inner /= n; seam /= T;
  return { inner, seam, ratio: inner === 0 ? (seam === 0 ? 0 : 99) : seam / inner };
}

module.exports = { T, shape, quadInside, makeQuery, localOcc, renderBlob, checkBlob, renderEdge, checkEdge, seamRatio, mod };
