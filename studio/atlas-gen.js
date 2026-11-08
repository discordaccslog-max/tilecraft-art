/* Tilecraft Studio — Grand Atlas overworld generator.
 * Shared by the build script (sample maps) and the studio (generator panel).
 * Same seed + same settings always produce the same world. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../js/autotile.js'));
  else root.TCAtlasGen = factory(root.TCAutotile);
})(typeof self !== 'undefined' ? self : this, function (AT) {
  'use strict';

  function hashString(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function h2(x, y, s) { var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function vnoise(x, y, s) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    var a = h2(ix, iy, s), b = h2(ix + 1, iy, s), c = h2(ix, iy + 1, s), d = h2(ix + 1, iy + 1, s);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  }
  function fbm(x, y, s, oct) { var v = 0, amp = 0.5, f = 1, n = 0; for (var o = 0; o < oct; o++) { v += vnoise(x * f, y * f, s + o * 101) * amp; n += amp; amp *= 0.5; f *= 2; } return v / n; }
  function quantile(vals, q) { var a = Array.prototype.slice.call(vals).sort(function (p, r) { return p - r; }); if (!a.length) return 1; return a[Math.max(0, Math.min(a.length - 1, Math.floor(q * (a.length - 1))))]; }

  var DEFAULTS = { seed: 'atlas', width: 64, height: 44, land: 0.5, mountains: 0.5, forests: 0.5, rivers: 0.5, towns: 0.5 };

  function generate(options) {
    var o = {}; for (var k in DEFAULTS) o[k] = (options && options[k] !== undefined) ? options[k] : DEFAULTS[k];
    var W = o.width | 0, H = o.height | 0, N = W * H, S = hashString(o.seed), R = rng(S);
    var idx = function (x, y) { return y * W + x; };
    var inb = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H; };
    var elev = new Float32Array(N), moist = new Float32Array(N), temp = new Float32Array(N);
    var scale = 4.2 / Math.max(W, H) * 1.6;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var nx = x / (W - 1) * 2 - 1, ny = y / (H - 1) * 2 - 1;
      var e = fbm(x * scale + 11, y * scale + 7, S, 5);
      var edge = Math.max(Math.abs(nx), Math.abs(ny));
      e -= Math.pow(edge, 3) * 0.55;
      elev[idx(x, y)] = e;
      moist[idx(x, y)] = fbm(x * scale * 1.3 + 53, y * scale * 1.3 + 17, S + 7, 4);
      temp[idx(x, y)] = 1 - Math.abs(ny) * 1.05 + (fbm(x * scale + 91, y * scale + 3, S + 13, 3) - 0.5) * 0.45;
    }
    var land = new Uint8Array(N), seaLevel = quantile(elev, 1 - (0.22 + o.land * 0.5));
    for (var i = 0; i < N; i++) land[i] = elev[i] > seaLevel ? 1 : 0;
    for (var pass = 0; pass < 2; pass++) {
      var copy = land.slice();
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        var n4 = 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var xx = x + d[0], yy = y + d[1]; n4 += inb(xx, yy) ? copy[idx(xx, yy)] : 0; });
        if (copy[idx(x, y)] && n4 <= 1) land[idx(x, y)] = 0;
        if (!copy[idx(x, y)] && n4 >= 3) land[idx(x, y)] = 1;
      }
    }
    for (x = 0; x < W; x++) { land[idx(x, 0)] = 0; land[idx(x, H - 1)] = 0; }
    for (y = 0; y < H; y++) { land[idx(0, y)] = 0; land[idx(W - 1, y)] = 0; }
    var landElev = []; for (i = 0; i < N; i++) if (land[i]) landElev.push(elev[i]);
    var mountainCut = quantile(landElev, 1 - (0.04 + o.mountains * 0.2));
    var hillCut = quantile(landElev, 1 - (0.1 + o.mountains * 0.3));
    var mountains = new Uint8Array(N), hills = new Uint8Array(N), desert = new Uint8Array(N), snow = new Uint8Array(N), forest = new Uint8Array(N);
    var moistLand = []; for (i = 0; i < N; i++) if (land[i]) moistLand.push(moist[i]);
    var forestCut = quantile(moistLand, 1 - o.forests * 0.55);
    for (i = 0; i < N; i++) {
      if (!land[i]) continue;
      var xi = i % W, yi = (i / W) | 0;
      var coastal = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var xx = xi + d[0], yy = yi + d[1]; return inb(xx, yy) && !land[idx(xx, yy)]; });
      if (elev[i] > mountainCut && !coastal) mountains[i] = 1;
      else if (elev[i] > hillCut) hills[i] = 1;
      if (mountains[i]) continue;
      if (temp[i] < 0.24) snow[i] = 1;
      else if (temp[i] > 0.74 && moist[i] < 0.5) desert[i] = 1;
      else if (moist[i] > forestCut && !hills[i]) forest[i] = 1;
    }
    /* rivers: flow downhill from high ground to the sea */
    var river = new Uint8Array(N), mouths = {};
    var sources = []; for (i = 0; i < N; i++) if (land[i] && (mountains[i] || hills[i]) && !snow[i]) sources.push(i);
    var riverCount = Math.round(o.rivers * 9);
    for (var r = 0; r < riverCount * 4 && Object.keys(mouths).length < riverCount && sources.length; r++) {
      var s = sources[Math.floor(R() * sources.length)];
      var path = [], cur = s, seen = {};
      var ok = false;
      for (var step = 0; step < W + H; step++) {
        path.push(cur); seen[cur] = 1;
        var cx = cur % W, cy = (cur / W) | 0, best = -1, bestE = Infinity, mouthDir = -1, join = -1;
        [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]].forEach(function (d) {
          var xx = cx + d[0], yy = cy + d[1]; if (!inb(xx, yy)) return; var j = idx(xx, yy);
          if (!land[j]) { if (mouthDir < 0) mouthDir = d[2]; return; }
          if (seen[j]) return;
          if (river[j] && path.length > 3 && join < 0) join = j;
          var ev = elev[j] + h2(xx, yy, S + 5) * 0.004;
          if (ev < bestE) { bestE = ev; best = j; }
        });
        if (join >= 0) { path.push(join); ok = true; break; }
        if (mouthDir >= 0 && path.length > 3) { mouths[cur] = mouthDir; ok = true; break; }
        if (best < 0 || river[best]) { if (best >= 0 && river[best] && path.length > 3) { path.push(best); ok = true; } break; }
        cur = best;
      }
      if (ok) { path.forEach(function (j) { if (!mountains[j]) river[j] = 1; }); }
    }
    for (i = 0; i < N; i++) if (river[i]) { forest[i] = 0; }
    /* settlements */
    var markers = [], taken = new Uint8Array(N);
    var free = function (j, spacing) { var x0 = j % W, y0 = (j / W) | 0; for (var m = 0; m < markers.length; m++) { if (Math.max(Math.abs(markers[m].x - x0), Math.abs(markers[m].y - y0)) < spacing) return false; } return true; };
    var cands = [];
    for (i = 0; i < N; i++) {
      if (!land[i] || mountains[i] || river[i]) continue;
      var x1 = i % W, y1 = (i / W) | 0, coast = 0, nearRiver = 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var xx = x1 + dx, yy = y1 + dy; if (!inb(xx, yy)) continue; var j = idx(xx, yy); if (!land[j]) coast = 1; if (river[j]) nearRiver = 1; }
      cands.push({ i: i, coast: coast, score: coast * 0.35 + nearRiver * 0.45 + (forest[i] || desert[i] || snow[i] ? 0 : 0.3) + h2(x1, y1, S + 9) * 0.4 });
    }
    cands.sort(function (a, b) { return b.score - a.score; });
    var townCount = 2 + Math.round(o.towns * 12);
    for (var c = 0; c < cands.length && markers.filter(function (m) { return m.settlement; }).length < townCount; c++) {
      var cd = cands[c]; if (!free(cd.i, 6)) continue;
      var nSet = markers.filter(function (m) { return m.settlement; }).length;
      var kind = nSet === 0 ? 'city' : cd.coast && nSet % 3 === 1 ? 'port' : hills[cd.i] && !markers.some(function (m) { return m.kind === 'castle'; }) ? 'castle' : nSet % 2 ? 'town' : 'village';
      markers.push({ x: cd.i % W, y: (cd.i / W) | 0, kind: kind, settlement: true }); taken[cd.i] = 1;
    }
    var landmarkKinds = ['tower', 'ruins', 'shrine', 'stones', 'obelisk', 'windmill', 'camp', 'cave', 'mine', 'lighthouse'];
    var lmCount = 2 + Math.round(o.towns * 6);
    for (var l = 0, tries = 0; l < lmCount && tries < 400; tries++) {
      var kindL = landmarkKinds[Math.floor(R() * landmarkKinds.length)];
      var pick = -1;
      for (var t = 0; t < 60; t++) {
        var j2 = Math.floor(R() * N); if (!land[j2] || mountains[j2] || river[j2] || taken[j2] || !free(j2, 4)) continue;
        var px = j2 % W, py = (j2 / W) | 0;
        var adj = function (grid) { for (var dy2 = -1; dy2 <= 1; dy2++) for (var dx2 = -1; dx2 <= 1; dx2++) { var xx2 = px + dx2, yy2 = py + dy2; if (inb(xx2, yy2) && grid(idx(xx2, yy2))) return true; } return false; };
        if ((kindL === 'cave' || kindL === 'mine') && !adj(function (q) { return mountains[q]; })) continue;
        if (kindL === 'lighthouse' && !adj(function (q) { return !land[q]; })) continue;
        if (kindL === 'windmill' && (forest[j2] || desert[j2] || snow[j2])) continue;
        if (kindL === 'camp' && !adj(function (q) { return forest[q]; })) continue;
        pick = j2; break;
      }
      if (pick < 0) continue;
      markers.push({ x: pick % W, y: (pick / W) | 0, kind: kindL }); taken[pick] = 1; l++;
    }
    /* roads: minimum spanning tree between settlements, routed around mountains, bridging straight river runs */
    var road = new Uint8Array(N), bridges = [];
    var towns = markers.filter(function (m) { return m.settlement; });
    var riverMask = function (j) { var x3 = j % W, y3 = (j / W) | 0; return AT.edgeMask(function (a, b) { return inb(a, b) && !!river[idx(a, b)]; }, x3, y3) | (mouths[j] || 0); };
    var cost = function (j) { if (!land[j] || mountains[j]) return Infinity; return forest[j] ? 3 : hills[j] ? 2.5 : desert[j] || snow[j] ? 2 : 1; };
    var route = function (a, b) {
      var start = idx(a.x, a.y), goal = idx(b.x, b.y), dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), via = new Int32Array(N).fill(-1), open = [start];
      dist[start] = 0;
      while (open.length) {
        var bi = 0; for (var q = 1; q < open.length; q++) if (dist[open[q]] + Math.abs(open[q] % W - b.x) + Math.abs(((open[q] / W) | 0) - b.y) < dist[open[bi]] + Math.abs(open[bi] % W - b.x) + Math.abs(((open[bi] / W) | 0) - b.y)) bi = q;
        var u = open.splice(bi, 1)[0]; if (u === goal) break;
        var ux = u % W, uy = (u / W) | 0;
        [[1, 0, 2, 8], [-1, 0, 8, 2], [0, 1, 4, 1], [0, -1, 1, 4]].forEach(function (d) {
          var vx = ux + d[0], vy = uy + d[1]; if (!inb(vx, vy)) return; var v = idx(vx, vy), bridgeAt = -1, c2;
          if (river[v]) {
            var m = riverMask(v), perpendicular = d[1] === 0 ? (m === 5) : (m === 10);
            if (!perpendicular) return;
            var wx = vx + d[0], wy = vy + d[1]; if (!inb(wx, wy)) return; var w2 = idx(wx, wy);
            if (river[w2] || cost(w2) === Infinity) return;
            bridgeAt = v; v = w2; c2 = 6 + cost(w2);
          } else { c2 = cost(v); if (c2 === Infinity) return; if (road[v]) c2 *= 0.5; }
          if (dist[u] + c2 < dist[v]) { var wasOpen = dist[v] < Infinity; dist[v] = dist[u] + c2; prev[v] = u; via[v] = bridgeAt; if (!wasOpen || open.indexOf(v) < 0) open.push(v); }
        });
      }
      if (dist[goal] === Infinity) return false;
      for (var cu = goal; cu !== -1; cu = prev[cu]) { road[cu] = 1; if (via[cu] >= 0) { road[via[cu]] = 1; var bxx = via[cu] % W, byy = (via[cu] / W) | 0; bridges.push({ x: bxx, y: byy, horizontal: (cu % W) !== (prev[cu] % W) }); } }
      return true;
    };
    if (towns.length > 1) {
      var inTree = [0], rest = towns.map(function (_, k2) { return k2; }).slice(1);
      while (rest.length) {
        var best2 = null;
        inTree.forEach(function (ti) { rest.forEach(function (ri) { var d2 = Math.hypot(towns[ti].x - towns[ri].x, towns[ti].y - towns[ri].y); if (!best2 || d2 < best2.d) best2 = { a: ti, b: ri, d: d2 }; }); });
        route(towns[best2.a], towns[best2.b]);
        inTree.push(best2.b); rest.splice(rest.indexOf(best2.b), 1);
      }
    }
    var shallows = new Uint8Array(N);
    for (i = 0; i < N; i++) {
      if (land[i]) { shallows[i] = 1; continue; }
      var x4 = i % W, y4 = (i / W) | 0;
      for (var dy3 = -1; dy3 <= 1; dy3++) for (var dx3 = -1; dx3 <= 1; dx3++) { var xx3 = x4 + dx3, yy3 = y4 + dy3; if (inb(xx3, yy3) && land[idx(xx3, yy3)]) shallows[i] = 1; }
    }
    var sea = [];
    for (var sIdx = 0, tries2 = 0; sIdx < 3 + Math.round(R() * 3) && tries2 < 200; tries2++) {
      var j3 = Math.floor(R() * N); if (land[j3] || shallows[j3]) continue;
      sea.push({ x: j3 % W, y: (j3 / W) | 0, kind: ['ship', 'waves', 'waves', 'whirlpool', 'reef'][sIdx % 5] }); sIdx++;
    }
    return { seed: String(o.seed), options: o, width: W, height: H, land: land, shallows: shallows, mountains: mountains, hills: hills, desert: desert, snowfield: snow, forest: forest, river: river, mouths: mouths, road: road, bridges: bridges, markers: markers, sea: sea };
  }

  /* Converts a world into tile layers using the pack metadata: [{name, data: [{sheet, tile} | 0]}] */
  function toLayers(world, meta) {
    var W = world.width, H = world.height, N = W * H;
    var set = function (id) { for (var i = 0; i < meta.autotile.length; i++) if (meta.autotile[i].id === id) return meta.autotile[i]; return null; };
    var asset = function (id) { for (var i = 0; i < meta.assets.length; i++) if (meta.assets[i].id === id) return meta.assets[i]; return null; };
    var ref = function (a) { return { sheet: a.sheet, tile: a.tile }; };
    var layers = [];
    var oceanA = asset('ga-ocean'), ocean = new Array(N); for (var i = 0; i < N; i++) ocean[i] = ref(oceanA);
    layers.push({ name: 'Ocean', data: ocean });
    var blob = function (name, id, grid) {
      var s = set(id), data = new Array(N).fill(0), get = AT.clampGetter(grid, W, H);
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (grid[y * W + x]) data[y * W + x] = { sheet: s.sheet, tile: s.tiles[AT.blobIndex(get, x, y)] };
      layers.push({ name: name, data: data });
    };
    blob('Shallows', 'shallows', world.shallows);
    blob('Land', 'land', world.land);
    blob('Desert', 'desert', world.desert);
    blob('Snowfield', 'snowfield', world.snowfield);
    blob('Hills', 'hills', world.hills);
    blob('Forest', 'forest', world.forest);
    blob('Mountains', 'mountains', world.mountains);
    var inb = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H; };
    var rs = set('river'), rd = set('road');
    var rivers = new Array(N).fill(0), roads = new Array(N).fill(0);
    for (var y2 = 0; y2 < H; y2++) for (var x2 = 0; x2 < W; x2++) {
      var j = y2 * W + x2;
      if (world.river[j]) rivers[j] = { sheet: rs.sheet, tile: rs.tiles[AT.edgeMask(function (a, b) { return inb(a, b) && !!world.river[b * W + a]; }, x2, y2) | (world.mouths[j] || 0)] };
      if (world.road[j]) roads[j] = { sheet: rd.sheet, tile: rd.tiles[AT.edgeMask(function (a, b) { return inb(a, b) && !!world.road[b * W + a]; }, x2, y2)] };
    }
    world.bridges.forEach(function (b) { roads[b.y * W + b.x] = ref(asset(b.horizontal ? 'ga-bridge-h' : 'ga-bridge-v')); });
    layers.push({ name: 'Rivers', data: rivers });
    layers.push({ name: 'Roads', data: roads });
    var marks = new Array(N).fill(0);
    world.markers.forEach(function (m) { var a = asset('ga-marker-' + m.kind); if (a) marks[m.y * W + m.x] = ref(a); });
    world.sea.forEach(function (m) { var a = asset('ga-sea-' + m.kind); if (a) marks[m.y * W + m.x] = ref(a); });
    layers.push({ name: 'Markers', data: marks });
    return layers;
  }

  return { generate: generate, toLayers: toLayers, DEFAULTS: DEFAULTS, hashString: hashString };
});
