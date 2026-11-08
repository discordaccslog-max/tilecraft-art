/* Tilecraft Studio — map playground. Paint with ground, autotiling terrain and objects;
 * autotiling is applied as you paint. Maps are saved in this browser only. */
window.TCPlayground = (function () {
  'use strict';
  var AT = window.TCAutotile;
  var SIZES = [[16, 12], [24, 16], [32, 24], [48, 32], [64, 44]];

  function mount(el, p, S) {
    var h = S.h, meta = p.meta, T = meta.tileSize;
    var key = 'tilecraft.current.' + p.id, listKey = 'tilecraft.maps.' + p.id;
    var biomes = meta.extra && meta.extra.biomes ? meta.extra.biomes : null;
    var biome = biomes ? (S.store.get('tilecraft.biome', biomes[0].id)) : null;
    var tileInfo = {};
    meta.assets.forEach(function (a) {
      if (a.tile === undefined) return;
      var s = p.sheets[a.sheet], cw = a.w / T, ch = a.h / T;
      for (var j = 0; j < ch; j++) for (var i = 0; i < cw; i++) tileInfo[a.sheet + ':' + (a.tile + j * s.columns + i)] = { a: a, i: i, j: j };
    });
    var groundIds = {}; (meta.extra && meta.extra.ground || []).forEach(function (g) { g.assets.forEach(function (id) { groundIds[id] = g.id; }); });
    var setOf = function (id) { return meta.autotile.filter(function (s) { return s.id === id; })[0]; };
    var setBiome = function (s) { return s.id.split('-')[0]; };
    var inBiome = function (a) { return !biomes || a.biome === biome || (!a.biome && false); };

    /* ---------- map state ---------- */
    var blank = function (w, hh) {
      var g0 = meta.extra.ground[0].assets[0];
      var m = { w: w, h: hh, ground: new Array(w * hh).fill(null), terrain: {}, objects: new Array(w * hh).fill(null), overlay: new Array(w * hh).fill(null), name: 'Untitled map' };
      var firstGroup = biomes ? meta.extra.ground.filter(function (g) { return g.id === biome; })[0] : meta.extra.ground[0];
      for (var i = 0; i < w * hh; i++) m.ground[i] = pickGround(firstGroup, i % w, Math.floor(i / w)) || g0;
      return m;
    };
    var pickGround = function (group, x, y) { var n = Math.imul(x, 374761393) + Math.imul(y, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); n = (n ^ (n >>> 16)) >>> 0; var plain = group.plain || 1; if (n % 10 < 8 || group.assets.length <= plain) return group.assets[(n >>> 4) % plain]; return group.assets[plain + ((n >>> 8) % (group.assets.length - plain))]; };
    var serialize = function (m) { var t = {}; Object.keys(m.terrain).forEach(function (k) { t[k] = Array.prototype.join.call(m.terrain[k], ''); }); return { w: m.w, h: m.h, name: m.name, ground: m.ground, terrain: t, objects: m.objects, overlay: m.overlay }; };
    var deserialize = function (d) { var m = { w: d.w, h: d.h, name: d.name || 'Untitled map', ground: d.ground, terrain: {}, objects: d.objects, overlay: d.overlay || new Array(d.w * d.h).fill(null) }; Object.keys(d.terrain || {}).forEach(function (k) { var a = new Uint8Array(d.w * d.h); for (var i = 0; i < a.length; i++) a[i] = d.terrain[k].charCodeAt(i) === 49 ? 1 : 0; m.terrain[k] = a; }); return m; };
    var clone = function (m) { return deserialize(JSON.parse(JSON.stringify(serialize(m)))); };
    var map = (function () { var d = S.store.get(key, null); try { return d ? deserialize(d) : blank(32, 24); } catch (e) { return blank(32, 24); } })();
    var undo = [], redo = [];
    var autosave = null;
    var changed = function () { clearTimeout(autosave); autosave = setTimeout(function () { S.store.set(key, serialize(map)); }, 400); render(); updateButtons(); };

    /* ---------- brushes ---------- */
    var brushes = [];
    (meta.extra.ground || []).forEach(function (g) { if (!biomes || g.id === biome) brushes.push({ type: 'ground', id: 'g:' + g.id, name: g.name + ' (mixed)', group: g, thumb: g.assets[0], section: 'Ground' }); });
    meta.assets.forEach(function (a) { if (groundIds[a.id] && inBiome(a)) brushes.push({ type: 'groundTile', id: 'gt:' + a.id, name: a.name, asset: a.id, thumb: a.id, section: 'Ground' }); });
    meta.autotile.forEach(function (s) { if (biomes && setBiome(s) !== biome) return; brushes.push({ type: 'terrain', id: 't:' + s.id, name: s.name, set: s.id, thumb: s.assets[s.type === 'blob47' ? 46 : 15], section: 'Terrain' }); });
    meta.assets.forEach(function (a) {
      if (a.tile === undefined || a.autotile || groundIds[a.id] || !p.sheets[a.sheet].tileset || !inBiome(a)) return;
      var overlay = (a.tags || []).some(function (t) { return /overlay/.test(t); });
      brushes.push({ type: 'stamp', id: 's:' + a.id, name: a.name, asset: a.id, thumb: a.id, layer: overlay ? 'overlay' : 'objects', section: a.category });
    });
    var brush = brushes.filter(function (b) { return b.type === 'terrain'; })[0] || brushes[0];
    var tool = 'brush', zoom = S.store.get('tilecraft.pgzoom', 2), grid = false, animate = !S.reduce.matches;
    var cursor = { x: 0, y: 0, show: false };

    /* ---------- painting ---------- */
    var setCell = function (x, y) {
      if (x < 0 || y < 0 || x >= map.w || y >= map.h) return;
      var i = y * map.w + x;
      if (tool === 'erase') {
        if (map.overlay[i]) map.overlay[i] = null; else if (map.objects[i]) map.objects[i] = null;
        else { var sets = Object.keys(map.terrain).map(setOf).filter(Boolean).sort(function (a, b) { return b.order - a.order; }); for (var k = 0; k < sets.length; k++) if (map.terrain[sets[k].id][i]) { map.terrain[sets[k].id][i] = 0; break; } }
        return;
      }
      if (brush.type === 'ground') map.ground[i] = pickGround(brush.group, x, y);
      else if (brush.type === 'groundTile') map.ground[i] = brush.asset;
      else if (brush.type === 'terrain') { if (!map.terrain[brush.set]) map.terrain[brush.set] = new Uint8Array(map.w * map.h); map.terrain[brush.set][i] = 1; }
      else if (brush.type === 'stamp') {
        var a = p.byId[brush.asset], cw = a.w / T, ch = a.h / T, s = p.sheets[a.sheet];
        for (var j = 0; j < ch; j++) for (var ii = 0; ii < cw; ii++) { var X = x + ii, Y = y - ch + 1 + j; if (X < map.w && Y >= 0) map[brush.layer][Y * map.w + X] = { s: a.sheet, t: a.tile + j * s.columns + ii }; }
      }
    };
    var fill = function (x, y) {
      if (brush.type === 'stamp') { S.toast('Fill works with ground and terrain brushes'); return; }
      var w = map.w, hh = map.h, start = y * w + x, seen = new Uint8Array(w * hh), stack = [start];
      var match;
      if (brush.type === 'terrain') { if (!map.terrain[brush.set]) map.terrain[brush.set] = new Uint8Array(w * hh); var arr = map.terrain[brush.set], v0 = arr[start]; if (v0) return; match = function (i) { return arr[i] === v0; }; }
      else { var g0 = map.ground[start]; match = function (i) { return map.ground[i] === g0; }; }
      while (stack.length) {
        var i = stack.pop(); if (seen[i] || !match(i)) continue; seen[i] = 1;
        var cx = i % w, cy = (i / w) | 0;
        if (brush.type === 'terrain') map.terrain[brush.set][i] = 1; else setCell(cx, cy);
        if (cx > 0) stack.push(i - 1); if (cx < w - 1) stack.push(i + 1); if (cy > 0) stack.push(i - w); if (cy < hh - 1) stack.push(i + w);
      }
    };
    var pick = function (x, y) {
      var i = y * map.w + x, found = null;
      var cellAsset = function (c) { var inf = c && tileInfo[c.s + ':' + c.t]; return inf ? inf.a.id : null; };
      var ov = cellAsset(map.overlay[i]) || cellAsset(map.objects[i]);
      if (ov) found = brushes.filter(function (b) { return b.asset === ov && b.type === 'stamp'; })[0];
      if (!found) { var sets = Object.keys(map.terrain).filter(function (k) { return map.terrain[k][i]; }).map(setOf).sort(function (a, b) { return b.order - a.order; }); if (sets.length) found = brushes.filter(function (b) { return b.set === sets[0].id; })[0]; }
      if (!found) found = brushes.filter(function (b) { return b.asset === map.ground[i]; })[0];
      if (found) { selectBrush(found); setTool('brush'); }
    };
    var applyAt = function (x, y, first) {
      if (tool === 'picker') { if (first) pick(x, y); return; }
      if (tool === 'fill') { if (first) fill(x, y); }
      else setCell(x, y);
      changed();
    };
    var snapshot = function () { undo.push(clone(map)); if (undo.length > 60) undo.shift(); redo.length = 0; };
    var doUndo = function () { if (!undo.length) return; redo.push(clone(map)); map = undo.pop(); changed(); };
    var doRedo = function () { if (!redo.length) return; undo.push(clone(map)); map = redo.pop(); changed(); };

    /* ---------- rendering ---------- */
    var stage = h('div', { class: 'pg-stage', tabindex: '0', role: 'application', 'aria-label': 'Map canvas. Arrow keys move the cursor, Space or Enter paints.' });
    var view = null, buf = document.createElement('canvas'), b = buf.getContext('2d');
    var images = {};
    var loadImages = function () { return Promise.all(meta.sheets.filter(function (s) { return s.tileset; }).map(function (s) { return S.sheetImage(p, s.id).then(function (img) { images[s.id] = img; }); })); };
    var frameOf = function (a, t) { if (!a.frames || !animate) return 0; var total = 0; a.frames.forEach(function (f) { total += f.duration; }); var u = t % total; for (var k = 0; k < a.frames.length; k++) { if (u < a.frames[k].duration) return k; u -= a.frames[k].duration; } return 0; };
    var drawTile = function (sheet, tile, dx, dy, t) {
      var s = p.sheets[sheet], img = images[sheet]; if (!img) return;
      var inf = tileInfo[sheet + ':' + tile], sx, sy;
      if (inf && inf.a.frames) { var f = inf.a.frames[frameOf(inf.a, t)]; sx = f.x + inf.i * T; sy = f.y + inf.j * T; }
      else { sx = (tile % s.columns) * T; sy = Math.floor(tile / s.columns) * T; }
      b.drawImage(img, sx, sy, T, T, dx, dy, T, T);
    };
    var setupCanvas = function () {
      buf.width = map.w * T; buf.height = map.h * T;
      view = S.pixelCanvas(map.w * T, map.h * T, zoom);
      stage.innerHTML = ''; stage.appendChild(view.canvas);
      bindPointer();
    };
    var render = function (t) {
      t = t || performance.now();
      if (!view || buf.width !== map.w * T || buf.height !== map.h * T) setupCanvas();
      b.clearRect(0, 0, buf.width, buf.height);
      var w = map.w;
      for (var i = 0; i < map.ground.length; i++) { var a = p.byId[map.ground[i]]; if (a) drawTile(a.sheet, a.tile, (i % w) * T, ((i / w) | 0) * T, t); }
      Object.keys(map.terrain).map(setOf).filter(Boolean).sort(function (x, y) { return x.order - y.order; }).forEach(function (s) {
        var arr = map.terrain[s.id];
        var get = s.type === 'blob47' ? AT.clampGetter(arr, map.w, map.h) : function (x, y) { return x >= 0 && y >= 0 && x < map.w && y < map.h && !!arr[y * map.w + x]; };
        for (var k = 0; k < arr.length; k++) if (arr[k]) { var x = k % w, y = (k / w) | 0; drawTile(s.sheet, s.tiles[s.type === 'blob47' ? AT.blobIndex(get, x, y) : AT.edgeMask(get, x, y)], x * T, y * T, t); }
      });
      ['objects', 'overlay'].forEach(function (L) { map[L].forEach(function (c, k) { if (c) drawTile(c.s, c.t, (k % w) * T, ((k / w) | 0) * T, t); }); });
      var ctx = view.ctx, D = view.D;
      ctx.clearRect(0, 0, view.canvas.width, view.canvas.height);
      ctx.drawImage(buf, 0, 0, buf.width, buf.height, 0, 0, buf.width * D, buf.height * D);
      if (grid) { ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.beginPath(); for (var gx = 0; gx <= map.w; gx++) { ctx.moveTo(gx * T * D + .5, 0); ctx.lineTo(gx * T * D + .5, map.h * T * D); } for (var gy = 0; gy <= map.h; gy++) { ctx.moveTo(0, gy * T * D + .5); ctx.lineTo(map.w * T * D, gy * T * D + .5); } ctx.stroke(); }
      if (cursor.show) { ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = Math.max(2, D); ctx.strokeRect(cursor.x * T * D + 1, cursor.y * T * D + 1, T * D - 2, T * D - 2); }
    };
    var hasAnim = meta.assets.some(function (a) { return a.frames && a.tile !== undefined; });
    var loop = function (now) { if (!document.body.contains(stage)) return; if (animate && hasAnim) render(now); setTimeout(function () { requestAnimationFrame(loop); }, 150); };

    var down = false;
    var cellFrom = function (e) { var r = view.canvas.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * map.w), Math.floor((e.clientY - r.top) / r.height * map.h)]; };
    var last = null;
    var lineCells = function (a, c, fn) { var x = a[0], y = a[1], dx = Math.abs(c[0] - x), dy = -Math.abs(c[1] - y), sx = x < c[0] ? 1 : -1, sy = y < c[1] ? 1 : -1, err = dx + dy; for (;;) { fn(x, y); if (x === c[0] && y === c[1]) break; var e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; } } };
    var bindPointer = function () {
      var c = view.canvas;
      c.addEventListener('pointerdown', function (e) { e.preventDefault(); down = true; c.setPointerCapture(e.pointerId); var cl = cellFrom(e); cursor.x = cl[0]; cursor.y = cl[1]; if (tool !== 'picker') snapshot(); applyAt(cl[0], cl[1], true); last = cl.join(','); status(cl); });
      c.addEventListener('pointermove', function (e) { var cl = cellFrom(e); status(cl); if (!down || tool === 'fill' || tool === 'picker' || (brush.type === 'stamp' && tool === 'brush')) return; if (cl.join(',') === last) return; var from = last.split(',').map(Number); last = cl.join(','); lineCells(from, cl, function (x, y) { setCell(x, y); }); changed(); });
      c.addEventListener('pointerup', function () { down = false; last = null; });
      c.addEventListener('pointercancel', function () { down = false; last = null; });
    };
    var statusEl = h('p', { class: 'pg-status', 'aria-live': 'polite' });
    var status = function (cl) { statusEl.textContent = 'Cell ' + cl[0] + ', ' + cl[1] + ' · ' + map.w + '×' + map.h + ' map · tool: ' + tool + ' · brush: ' + brush.name; };

    stage.addEventListener('focus', function () { cursor.show = true; render(); });
    stage.addEventListener('blur', function () { cursor.show = false; render(); });
    stage.addEventListener('keydown', function (e) {
      var k = e.key, used = true;
      if (k === 'ArrowLeft') cursor.x = Math.max(0, cursor.x - 1); else if (k === 'ArrowRight') cursor.x = Math.min(map.w - 1, cursor.x + 1);
      else if (k === 'ArrowUp') cursor.y = Math.max(0, cursor.y - 1); else if (k === 'ArrowDown') cursor.y = Math.min(map.h - 1, cursor.y + 1);
      else if (k === ' ' || k === 'Enter') { if (tool !== 'picker') snapshot(); applyAt(cursor.x, cursor.y, true); }
      else used = false;
      if (used) { e.preventDefault(); render(); status([cursor.x, cursor.y]); }
    });
    var onKey = function (e) {
      if (!document.body.contains(stage)) { document.removeEventListener('keydown', onKey); return; }
      var tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      var mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveAs(); }
      else if (!mod && !e.altKey) {
        var map2 = { b: 'brush', e: 'erase', f: 'fill', i: 'picker' };
        if (map2[e.key.toLowerCase()]) setTool(map2[e.key.toLowerCase()]);
        else if (e.key.toLowerCase() === 'g') { grid = !grid; gridBtn.setAttribute('aria-pressed', String(grid)); render(); }
        else if (e.key === '+' || e.key === '=') setZoom(zoom + 1); else if (e.key === '-') setZoom(zoom - 1);
      }
    };
    document.addEventListener('keydown', onKey);

    /* ---------- UI ---------- */
    var toolBtns = {};
    var setTool = function (t) { tool = t; Object.keys(toolBtns).forEach(function (k) { toolBtns[k].setAttribute('aria-pressed', String(k === t)); }); status([cursor.x, cursor.y]); };
    var setZoom = function (z) { zoom = Math.max(1, Math.min(4, z)); S.store.set('tilecraft.pgzoom', zoom); view = null; render(); };
    var tb = h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Playground tools' });
    [['brush', 'Brush', 'B'], ['erase', 'Erase', 'E'], ['fill', 'Fill', 'F'], ['picker', 'Pick', 'I']].forEach(function (t) { toolBtns[t[0]] = h('button', { class: 'tool-btn', type: 'button', 'aria-pressed': String(t[0] === tool), title: t[1] + ' (' + t[2] + ')', onclick: function () { setTool(t[0]); } }, t[1], ' ', h('span', { class: 'kbd', 'aria-hidden': 'true' }, t[2])); tb.appendChild(toolBtns[t[0]]); });
    var undoBtn = h('button', { class: 'tool-btn', type: 'button', title: 'Undo (Ctrl+Z)', onclick: doUndo }, 'Undo'), redoBtn = h('button', { class: 'tool-btn', type: 'button', title: 'Redo (Ctrl+Shift+Z)', onclick: doRedo }, 'Redo');
    var gridBtn = h('button', { class: 'tool-btn', type: 'button', 'aria-pressed': 'false', title: 'Grid (G)', onclick: function () { grid = !grid; gridBtn.setAttribute('aria-pressed', String(grid)); render(); } }, 'Grid');
    var animBtn = h('button', { class: 'tool-btn', type: 'button', 'aria-pressed': String(animate), onclick: function () { animate = !animate; animBtn.setAttribute('aria-pressed', String(animate)); render(); } }, 'Animate');
    var zOut = h('output', { class: 'kicker' }, zoom + '×');
    tb.appendChild(undoBtn); tb.appendChild(redoBtn); tb.appendChild(gridBtn); if (hasAnim) tb.appendChild(animBtn);
    tb.appendChild(h('button', { class: 'tool-btn', type: 'button', 'aria-label': 'Zoom out', onclick: function () { setZoom(zoom - 1); zOut.textContent = zoom + '×'; } }, '−'));
    tb.appendChild(zOut);
    tb.appendChild(h('button', { class: 'tool-btn', type: 'button', 'aria-label': 'Zoom in', onclick: function () { setZoom(zoom + 1); zOut.textContent = zoom + '×'; } }, '+'));
    tb.appendChild(h('button', { class: 'tool-btn', type: 'button', onclick: function () { tourIt(true); } }, 'Tips'));
    var updateButtons = function () { undoBtn.disabled = !undo.length; redoBtn.disabled = !redo.length; };

    var brushList = h('div', { class: 'brush-list', role: 'group', 'aria-label': 'Brushes' });
    var brushBtns = {};
    var selectBrush = function (bb) { brush = bb; Object.keys(brushBtns).forEach(function (k) { brushBtns[k].setAttribute('aria-pressed', String(k === bb.id)); }); if (tool === 'erase' || tool === 'picker') setTool('brush'); status([cursor.x, cursor.y]); };
    var sections = []; brushes.forEach(function (bb) { if (sections.indexOf(bb.section) < 0) sections.push(bb.section); });
    sections.forEach(function (sec) {
      brushList.appendChild(h('h3', null, sec));
      var g = h('div', { class: 'brushes' }); brushList.appendChild(g);
      brushes.filter(function (bb) { return bb.section === sec; }).forEach(function (bb) {
        var btn = h('button', { class: 'brush', type: 'button', title: bb.name, 'aria-label': bb.name, 'aria-pressed': String(bb === brush), onclick: function () { selectBrush(bb); } });
        brushBtns[bb.id] = btn; g.appendChild(btn);
        var a = p.byId[bb.thumb];
        if (a) S.sheetImage(p, a.sheet).then(function (img) { var k = Math.max(1, Math.floor(40 / Math.max(a.w, a.h))); var v = S.pixelCanvas(a.w, a.h, Math.min(k, 2)); S.drawAsset(v.ctx, img, a, 0, v.D); btn.appendChild(v.canvas); });
      });
    });

    /* saving */
    var nameIn = h('input', { type: 'text', value: map.name, 'aria-label': 'Map name', maxlength: '60' });
    var savedUl = h('ul', { class: 'saved-list' });
    var listSaved = function () {
      var list = S.store.get(listKey, []); savedUl.innerHTML = '';
      if (!list.length) savedUl.appendChild(h('li', { class: 'muted' }, 'No saved maps yet.'));
      list.forEach(function (m, idx) {
        savedUl.appendChild(h('li', null, h('span', null, m.name + ' (' + m.data.w + '×' + m.data.h + ')'),
          h('button', { class: 'tool-btn', type: 'button', onclick: function () { snapshot(); map = deserialize(m.data); nameIn.value = map.name; changed(); S.toast('Loaded ' + m.name); } }, 'Open'),
          h('button', { class: 'tool-btn', type: 'button', 'aria-label': 'Delete ' + m.name, onclick: function () { if (!window.confirm('Delete "' + m.name + '"?')) return; list.splice(idx, 1); S.store.set(listKey, list); listSaved(); } }, '✕')));
      });
    };
    var saveAs = function () {
      map.name = (nameIn.value || 'Untitled map').trim();
      var list = S.store.get(listKey, []), existing = list.filter(function (m) { return m.name === map.name; })[0];
      var entry = { name: map.name, updated: new Date().toISOString(), data: serialize(map) };
      if (existing) list[list.indexOf(existing)] = entry; else list.unshift(entry);
      if (S.store.set(listKey, list.slice(0, 30))) S.toast('Saved "' + map.name + '" in this browser');
      listSaved();
    };
    var sizeSel = h('select', { 'aria-label': 'New map size' }); SIZES.forEach(function (s) { sizeSel.appendChild(h('option', { value: s.join('x'), selected: s[0] === map.w && s[1] === map.h }, s[0] + '×' + s[1] + ' tiles')); });
    var exportPNG = function (k) {
      render(0);
      var c = document.createElement('canvas'); c.width = buf.width * k; c.height = buf.height * k; var ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(buf, 0, 0, c.width, c.height);
      S.canvasBlob(c).then(function (bl) { S.download((map.name || 'map').replace(/[^\w-]+/g, '-') + (k > 1 ? '@' + k + 'x' : '') + '.png', bl); });
    };
    var exportTMX = function () {
      var layers = [], w = map.w;
      layers.push({ name: 'Ground', data: map.ground.map(function (id) { var a = p.byId[id]; return a ? { sheet: a.sheet, tile: a.tile } : 0; }) });
      Object.keys(map.terrain).map(setOf).filter(Boolean).sort(function (x, y) { return x.order - y.order; }).forEach(function (s) {
        var arr = map.terrain[s.id]; if (!arr.some(function (v) { return v; })) return;
        var get = s.type === 'blob47' ? AT.clampGetter(arr, map.w, map.h) : function (x, y) { return x >= 0 && y >= 0 && x < map.w && y < map.h && !!arr[y * map.w + x]; };
        layers.push({ name: s.name, data: Array.prototype.map.call(arr, function (v, k) { return v ? { sheet: s.sheet, tile: s.tiles[s.type === 'blob47' ? AT.blobIndex(get, k % w, (k / w) | 0) : AT.edgeMask(get, k % w, (k / w) | 0)] } : 0; }) });
      });
      layers.push({ name: 'Objects', data: map.objects.map(function (c) { return c ? { sheet: c.s, tile: c.t } : 0; }) });
      layers.push({ name: 'Overlay', data: map.overlay.map(function (c) { return c ? { sheet: c.s, tile: c.t } : 0; }) });
      S.download((map.name || 'map').replace(/[^\w-]+/g, '-') + '.tmx', new Blob([window.TCTiled.tmx(meta, map.w, map.h, layers, p.variant)], { type: 'application/xml' }));
      S.toast('Saved .tmx — put it in the pack\'s "tiled" folder to open it in Tiled');
    };
    var side = h('div', { class: 'pg-side' });
    if (biomes) {
      var bs = h('select', { 'aria-label': 'Biome', onchange: function () { S.store.set('tilecraft.biome', bs.value); el.innerHTML = ''; mount(el, p, S); } });
      biomes.forEach(function (bm) { bs.appendChild(h('option', { value: bm.id, selected: bm.id === biome }, bm.name)); });
      side.appendChild(h('label', { class: 'small muted' }, 'Biome ', bs));
    }
    side.appendChild(brushList);
    side.appendChild(h('div', { class: 'panel', id: 'pg-file' }, h('h3', { style: 'font-size:1rem' }, 'Map'), h('p', null, nameIn), h('div', { class: 'toolbar' }, h('button', { class: 'tool-btn', type: 'button', onclick: saveAs }, 'Save'), h('button', { class: 'tool-btn', type: 'button', onclick: function () { exportPNG(1); } }, 'PNG 1×'), h('button', { class: 'tool-btn', type: 'button', onclick: function () { exportPNG(2); } }, 'PNG 2×'), h('button', { class: 'tool-btn', type: 'button', onclick: exportTMX }, 'Tiled .tmx')),
      h('div', { class: 'toolbar' }, sizeSel, h('button', { class: 'tool-btn', type: 'button', onclick: function () { var s = sizeSel.value.split('x'); snapshot(); map = blank(+s[0], +s[1]); nameIn.value = map.name; view = null; changed(); } }, 'New map')), savedUl));
    el.appendChild(tb);
    el.appendChild(h('div', { class: 'pg-layout' }, side, h('div', { id: 'pg-canvas-wrap' }, stage, statusEl)));
    var tourIt = function (force) {
      S.tour('playground', [
        { el: '.brush-list', title: 'Pick a brush', text: 'Ground, terrain and objects for this pack. Terrain brushes autotile: just paint and the edges and corners draw themselves.' },
        { el: '.pg-stage', title: 'Paint on the map', text: 'Click or drag to paint. With the keyboard, focus the map, move with the arrow keys and press Space or Enter to paint.' },
        { el: '.toolbar', title: 'Tools and shortcuts', text: 'Brush (B), Erase (E), Fill (F) and Pick (I). Undo with Ctrl+Z, redo with Ctrl+Shift+Z, toggle the grid with G.' },
        { el: '#pg-file', title: 'Save and export', text: 'Maps save in this browser. Export a PNG, or a Tiled .tmx that uses the pack\'s own tilesets.' }
      ], force);
    };
    loadImages().then(function () { render(); listSaved(); updateButtons(); status([0, 0]); requestAnimationFrame(loop); tourIt(false); });
    window.addEventListener('beforeunload', function () { S.store.set(key, serialize(map)); });
  }
  /* used by the overworld generator: open a generated world here */
  function openMap(packId, data, S) { S.store.set('tilecraft.current.' + packId, data); location.hash = '#/pack/' + packId + '/playground'; }
  return { mount: mount, openMap: openMap };
})();
