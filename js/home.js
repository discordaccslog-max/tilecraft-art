/* Tilecraft Art — home page: hero dusk, parallax showcase and the free mini map painter. */
(function () {
  'use strict';
  var PX = window.TCPixel, AT = window.TCAutotile;
  var reduce = PX.reduce;

  /* ---------- hero: day to dusk as the visitor scrolls ---------- */
  var hero = document.querySelector('.diorama');
  if (hero) {
    var sceneEl = hero.querySelector('.diorama-canvas'), dusk = hero.querySelector('.dusk'), glow = hero.querySelector('.glow-layer');
    sceneEl.addEventListener('scene-ready', function (e) {
      var info = e.detail; if (!info) return;
      PX.loadScenes().then(function (all) {
        var lights = all.hero.glow || [];
        var place = function () {
          var cr = info.canvas.getBoundingClientRect(), hr = hero.getBoundingClientRect();
          glow.textContent = '';
          lights.forEach(function (l) {
            var x = (l[0] - info.offset) * info.scale; if (x < 0 || x > cr.width) return;
            var s = document.createElement('span'); s.style.left = (cr.left - hr.left + x) + 'px'; s.style.top = (cr.top - hr.top + l[1] * info.scale) + 'px'; glow.appendChild(s);
          });
        };
        place(); window.addEventListener('resize', place);
      });
    });
    if (!reduce.matches) {
      var ticking = false;
      var update = function () {
        ticking = false;
        var r = hero.getBoundingClientRect(), vh = window.innerHeight;
        var p = Math.min(1, Math.max(0, (vh * 0.75 - r.top) / (vh * 0.75 + r.height * 0.4)));
        p = Math.min(1, Math.max(0, (p - 0.35) / 0.6));
        dusk.style.opacity = (p * 0.72).toFixed(3);
        glow.style.opacity = p.toFixed(3);
      };
      window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
      update();
    }
  }

  /* ---------- studio showcase: layered parallax backdrops ---------- */
  var layers = document.querySelectorAll('.px-layer[data-scene-bg]');
  if (layers.length) PX.loadScenes().then(function (all) {
    layers.forEach(function (el) { var s = all[el.getAttribute('data-scene-bg')]; if (s) PX.renderScene(el, s, { max: 8 }); });
    if (reduce.matches) return;
    var section = document.querySelector('.studio-showcase'), tick = false;
    var move = function () {
      tick = false;
      var r = section.getBoundingClientRect();
      layers.forEach(function (el) { var d = parseFloat(el.getAttribute('data-depth')) || 0.2; el.style.transform = 'translate3d(0,' + Math.round(-r.top * d) + 'px,0)'; });
    };
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(move); } }, { passive: true });
    move();
  });

  /* ---------- free mini map painter (Mossway Sampler) ---------- */
  var painter = document.querySelector('[data-painter]');
  if (painter && AT) PX.loadMeta('sample').then(function (meta) {
    var W = 20, H = 12, T = 16;
    var sheet = meta.sheets[0];
    return PX.loadImage('assets/packs/sample/' + sheet.file).then(function (img) {
      var byId = {}; meta.assets.forEach(function (a) { byId[a.id] = a; });
      var ground = meta.extra.ground[0].assets.map(function (id) { return byId[id]; });
      var stoneSet = meta.autotile.filter(function (s) { return s.id === 'stones'; })[0];
      var plants = ['free-fern', 'free-glowcaps', 'free-bluebells', 'free-boulder', 'free-stump', 'free-birch'].map(function (id) { return byId[id]; });
      var stones = new Uint8Array(W * H), decor = new Array(W * H).fill(null), plantNext = 0;
      var reset = function () {
        stones.fill(0); decor.fill(null);
        [[0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [6, 5], [6, 4], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [12, 3], [13, 3], [13, 4], [13, 5], [13, 6], [13, 7], [13, 8], [14, 8], [15, 8], [16, 8], [17, 8], [18, 8], [19, 8]].forEach(function (c) { stones[c[1] * W + c[0]] = 1; });
        decor[3 * W + 2] = 'free-birch'; decor[4 * W + 17] = 'free-birch'; decor[9 * W + 4] = 'free-fern'; decor[6 * W + 9] = 'free-glowcaps'; decor[5 * W + 15] = 'free-bluebells'; decor[10 * W + 9] = 'free-boulder';
      };
      reset();
      var scale = Math.max(2, Math.min(4, Math.floor((painter.clientWidth - 24) / (W * T))));
      var holder = painter.querySelector('.painter-canvas');
      var v = PX.pixelCanvas(W * T, H * T, scale); holder.appendChild(v.canvas);
      var buf = document.createElement('canvas'); buf.width = W * T; buf.height = H * T; var b = buf.getContext('2d');
      var cursor = { x: 9, y: 6, show: false }, tool = 'stones';
      var tilePos = function (t) { return [(t % sheet.columns) * T, Math.floor(t / sheet.columns) * T]; };
      var get = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H && !!stones[y * W + x]; };
      var draw = function () {
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
          var h = ((x * 73856093) ^ (y * 19349663)) >>> 0, g = ground[h % 10 < 8 ? 0 : 1 + (h >> 4) % 2];
          var p = tilePos(g.tile); b.drawImage(img, p[0], p[1], T, T, x * T, y * T, T, T);
          if (stones[y * W + x]) { var q = tilePos(stoneSet.tiles[AT.edgeMask(get, x, y)]); b.drawImage(img, q[0], q[1], T, T, x * T, y * T, T, T); }
        }
        for (var i = 0; i < decor.length; i++) if (decor[i]) { var a = byId[decor[i]]; b.drawImage(img, a.x, a.y, a.w, a.h, (i % W) * T, Math.floor(i / W) * T - (a.h - T), a.w, a.h); }
        v.ctx.clearRect(0, 0, v.canvas.width, v.canvas.height);
        v.ctx.drawImage(buf, 0, 0, W * T, H * T, 0, 0, W * T * v.D, H * T * v.D);
        if (cursor.show) { v.ctx.strokeStyle = '#ffd36b'; v.ctx.lineWidth = Math.max(2, v.D); v.ctx.strokeRect(cursor.x * T * v.D + 1, cursor.y * T * v.D + 1, T * v.D - 2, T * v.D - 2); }
      };
      var apply = function (x, y, dragging) {
        if (x < 0 || y < 0 || x >= W || y >= H) return;
        var i = y * W + x;
        if (tool === 'stones') { stones[i] = 1; decor[i] = null; }
        else if (tool === 'erase') { stones[i] = 0; decor[i] = null; }
        else if (tool === 'decor' && !dragging) { stones[i] = 0; decor[i] = plants[plantNext % plants.length].id; plantNext++; }
        draw();
      };
      var cell = function (e) { var r = v.canvas.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * W), Math.floor((e.clientY - r.top) / r.height * H)]; };
      var down = false, prev = null;
      /* paint every cell on the line between pointer samples so fast strokes leave no gaps */
      var line = function (a, c, fn) { var x = a[0], y = a[1], dx = Math.abs(c[0] - x), dy = -Math.abs(c[1] - y), sx = x < c[0] ? 1 : -1, sy = y < c[1] ? 1 : -1, err = dx + dy; for (;;) { fn(x, y); if (x === c[0] && y === c[1]) break; var e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; } } };
      v.canvas.addEventListener('pointerdown', function (e) { down = true; v.canvas.setPointerCapture(e.pointerId); var c = cell(e); cursor.x = c[0]; cursor.y = c[1]; prev = c; apply(c[0], c[1], false); });
      v.canvas.addEventListener('pointermove', function (e) { if (!down) return; var c = cell(e); line(prev, c, function (x, y) { apply(x, y, true); }); prev = c; });
      v.canvas.addEventListener('pointerup', function () { down = false; });
      holder.addEventListener('focus', function () { cursor.show = true; draw(); });
      holder.addEventListener('blur', function () { cursor.show = false; draw(); });
      holder.addEventListener('keydown', function (e) {
        var k = e.key, moved = true;
        if (k === 'ArrowLeft') cursor.x = Math.max(0, cursor.x - 1); else if (k === 'ArrowRight') cursor.x = Math.min(W - 1, cursor.x + 1);
        else if (k === 'ArrowUp') cursor.y = Math.max(0, cursor.y - 1); else if (k === 'ArrowDown') cursor.y = Math.min(H - 1, cursor.y + 1);
        else if (k === ' ' || k === 'Enter') { apply(cursor.x, cursor.y, false); } else moved = false;
        if (moved) { e.preventDefault(); draw(); }
      });
      painter.querySelectorAll('[data-tool]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var t = btn.getAttribute('data-tool');
          if (t === 'clear') { stones.fill(0); decor.fill(null); draw(); return; }
          tool = t;
          painter.querySelectorAll('[data-tool]').forEach(function (o) { if (o.getAttribute('data-tool') !== 'clear') { var on = o === btn; o.classList.toggle('is-active', on); o.setAttribute('aria-pressed', String(on)); } });
        });
      });
      draw();
    });
  });
})();
