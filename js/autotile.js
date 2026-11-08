/* Tilecraft Art — autotile lookup shared by the build script, the studio and the home-page painter.
 *
 * blob47: 8-neighbour terrain. A cell's mask uses N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128.
 *         A diagonal only counts when both of its orthogonal neighbours are set, which leaves
 *         47 distinct tiles. Tiles are stored in ascending order of their normalised mask.
 * edge16: 4-neighbour connections (roads, rivers, fences, paths). Mask uses N=1 E=2 S=4 W=8
 *         and the tile index equals the mask.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TCAutotile = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var N = 1, NE = 2, E = 4, SE = 8, S = 16, SW = 32, W = 64, NW = 128;

  function normalize(m) {
    if (!((m & N) && (m & E))) m &= ~NE;
    if (!((m & S) && (m & E))) m &= ~SE;
    if (!((m & S) && (m & W))) m &= ~SW;
    if (!((m & N) && (m & W))) m &= ~NW;
    return m;
  }

  var BLOB47 = [];
  (function () {
    var seen = {};
    for (var m = 0; m < 256; m++) {
      var n = normalize(m);
      if (!seen[n]) { seen[n] = true; BLOB47.push(n); }
    }
    BLOB47.sort(function (a, b) { return a - b; });
  })();

  var BLOB_INDEX = new Array(256);
  for (var m = 0; m < 256; m++) BLOB_INDEX[m] = BLOB47.indexOf(normalize(m));

  /* get(x, y) returns true when that cell holds the terrain. */
  function blobMask(get, x, y) {
    var m = 0;
    if (get(x, y - 1)) m |= N;
    if (get(x + 1, y - 1)) m |= NE;
    if (get(x + 1, y)) m |= E;
    if (get(x + 1, y + 1)) m |= SE;
    if (get(x, y + 1)) m |= S;
    if (get(x - 1, y + 1)) m |= SW;
    if (get(x - 1, y)) m |= W;
    if (get(x - 1, y - 1)) m |= NW;
    return normalize(m);
  }

  function blobIndex(get, x, y) { return BLOB_INDEX[blobMask(get, x, y)]; }

  function edgeMask(get, x, y) {
    var m = 0;
    if (get(x, y - 1)) m |= 1;
    if (get(x + 1, y)) m |= 2;
    if (get(x, y + 1)) m |= 4;
    if (get(x - 1, y)) m |= 8;
    return m;
  }

  /* Wraps a grid so that cells outside the map repeat the nearest edge cell.
   * Terrain painted against the map edge then continues past it instead of
   * drawing a border along the frame. */
  function clampGetter(grid, w, h, value) {
    return function (x, y) {
      if (x < 0) x = 0; else if (x >= w) x = w - 1;
      if (y < 0) y = 0; else if (y >= h) y = h - 1;
      return value === undefined ? !!grid[y * w + x] : grid[y * w + x] === value;
    };
  }

  /* Tiled wang ids for a blob47 tile (mixed wang set, colour 1 = terrain, 2 = surroundings).
   * Order: top, top-right, right, bottom-right, bottom, bottom-left, left, top-left. */
  function blobWangId(mask) {
    var t = function (bit) { return (mask & bit) ? 1 : 2; };
    return [t(N), t(NE), t(E), t(SE), t(S), t(SW), t(W), t(NW)];
  }

  /* Tiled wang ids for an edge16 tile (edge wang set). Corners are left unset. */
  function edgeWangId(mask) {
    var t = function (bit) { return (mask & bit) ? 1 : 2; };
    return [t(1), 0, t(2), 0, t(4), 0, t(8), 0];
  }

  return {
    N: N, NE: NE, E: E, SE: SE, S: S, SW: SW, W: W, NW: NW,
    normalize: normalize, BLOB47: BLOB47, BLOB_INDEX: BLOB_INDEX,
    blobMask: blobMask, blobIndex: blobIndex, edgeMask: edgeMask,
    clampGetter: clampGetter, blobWangId: blobWangId, edgeWangId: edgeWangId
  };
});
