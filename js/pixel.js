/* Tilecraft Art — pixel renderer for the site.
 * Draws scenes, sprites, sheets and maps from the real pack files. Art is always shown at a
 * whole number of device pixels per art pixel, so it stays sharp at any screen density. */
window.TCPixel = (function () {
  'use strict';
  var ROOT = document.body.getAttribute('data-root') || '';
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var images = {}, metas = {}, scenesP = null;

  function url(p) { return /^(https?:|\/)/.test(p) ? p : ROOT + p; }
  function loadImage(src) {
    if (!images[src]) images[src] = new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { rej(new Error('Could not load ' + src)); }; i.src = url(src); });
    return images[src];
  }
  function loadMeta(packId) { if (!metas[packId]) metas[packId] = fetch(url('assets/packs/' + packId + '/meta.json')).then(function (r) { return r.json(); }); return metas[packId]; }
  function loadScenes() { if (!scenesP) scenesP = fetch(url('assets/scenes.json')).then(function (r) { return r.json(); }); return scenesP; }

  /* A canvas showing w×h art pixels with D device pixels per art pixel. */
  function pixelCanvas(w, h, cssScale) {
    var dpr = window.devicePixelRatio || 1, D = Math.max(1, Math.round(cssScale * dpr));
    var c = document.createElement('canvas');
    c.width = w * D; c.height = h * D;
    c.style.width = (w * D / dpr) + 'px'; c.style.height = (h * D / dpr) + 'px';
    c.className = 'px';
    var ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx: ctx, D: D };
  }
  function frameAt(frames, t, loop, hold) {
    var total = 0; for (var i = 0; i < frames.length; i++) total += frames[i][2];
    if (!loop) { var tt = t % (total + (hold || 0)); for (var k = 0; k < frames.length; k++) { if (tt < frames[k][2]) return frames[k]; tt -= frames[k][2]; } return frames[frames.length - 1]; }
    var u = t % total; for (var j = 0; j < frames.length; j++) { if (u < frames[j][2]) return frames[j]; u -= frames[j][2]; }
    return frames[0];
  }
  /* Runs draw(t) roughly 15 times a second while the element is on screen. */
  function animate(el, draw) {
    if (reduce.matches) { draw(0, true); return; }
    var visible = false, last = 0, start = performance.now();
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) requestAnimationFrame(tick); }) : null;
    function tick(now) {
      if (!visible || document.hidden) return;
      if (now - last > 60) { last = now; draw(now - start, false); }
      requestAnimationFrame(tick);
    }
    draw(0, false);
    if (io) io.observe(el); else { visible = true; requestAnimationFrame(tick); }
    document.addEventListener('visibilitychange', function () { if (!document.hidden && visible) requestAnimationFrame(tick); });
  }

  /* ---------- scenes ---------- */
  function sceneSheets(scene, variant) {
    var keys = Object.keys(scene.sheets), out = {};
    return Promise.all(keys.map(function (k) { return loadImage(scene.sheets[k].replace('{variant}', variant || 'summer')).then(function (img) { out[k] = img; }); })).then(function () { return out; });
  }
  function renderScene(el, scene, opt) {
    opt = opt || {};
    var W = scene.w * 16, H = scene.h * 16;
    var variants = scene.variants || null;
    return Promise.all((variants || [null]).map(function (v) { return sceneSheets(scene, v); })).then(function (sheetSets) {
      var cropW = W, scale, view, offset, lastW = -1;
      var info = {};
      /* (re)sizes the visible canvas to the element; called again when the window resizes */
      var layout = function () {
        var vw = el.clientWidth || (el.parentNode && el.parentNode.clientWidth) || window.innerWidth;
        if (vw < 80) vw = 960;
        if (vw === lastW && view) return;
        lastW = vw;
        if (opt.mode === 'hero') {
          scale = Math.max(2, Math.min(4, Math.round(vw / 520)));
          cropW = Math.min(W, Math.ceil(vw / scale));
        } else { cropW = W; scale = Math.max(1, Math.min(opt.max || (el.getAttribute('data-scale') === 'max' ? 6 : 3), Math.floor(vw / W))); }
        view = pixelCanvas(cropW, H, scale);
        el.textContent = ''; el.appendChild(view.canvas);
        offset = Math.max(0, Math.floor((W - cropW) / 2));
        info.scale = view.D / (window.devicePixelRatio || 1); info.offset = offset; info.cropW = cropW; info.canvas = view.canvas;
      };
      layout();
      var rt = null;
      window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { var before = view; layout(); if (view !== before) { draw(performance.now(), reduce.matches); el.dispatchEvent(new CustomEvent('scene-resize', { detail: info })); } }, 150); });
      var buf = document.createElement('canvas'); buf.width = W; buf.height = H;
      var b = buf.getContext('2d'); b.imageSmoothingEnabled = false;
      var spriteState = scene.sprites.map(function () { return { idx: 0, start: 0 }; });
      var dirRow = { down: 0, left: 1, right: 2, up: 3 };
      function draw(t, still) {
        var vi = variants ? Math.floor(t / (scene.variantMs || 2500)) % variants.length : 0;
        var sheets = sheetSets[vi];
        b.clearRect(0, 0, W, H);
        for (var L = 0; L < scene.layers.length; L++) {
          var layer = scene.layers[L];
          for (var i = 0; i < layer.length; i++) {
            var ti = layer[i]; if (!ti) continue;
            var tile = scene.tiles[ti - 1], f = still ? tile.f[Math.floor(tile.f.length / 2)] : frameAt(tile.f, t, true);
            b.drawImage(sheets[tile.s], f[0], f[1], 16, 16, (i % scene.w) * 16, Math.floor(i / scene.w) * 16, 16, 16);
          }
        }
        scene.sprites.forEach(function (sp, k) {
          var st = spriteState[k], part = sp.cycle[st.idx], dur = 0;
          part.f.forEach(function (fr) { dur += fr[2]; });
          var span = part.loop ? Math.max(dur * 3, 1800) : dur + (sp.hold || 500);
          if (!still && t - st.start > span) { st.idx = (st.idx + 1) % sp.cycle.length; st.start = t; part = sp.cycle[st.idx]; }
          var fr2 = still ? part.f[Math.floor(part.f.length / 2)] : frameAt(part.f, t - st.start, part.loop, sp.hold || 500);
          b.drawImage(sheets[part.s], fr2[0], fr2[1], part.w, part.h, sp.x, sp.y, part.w, part.h);
        });
        scene.walkers.forEach(function (wk) {
          var moving = wk.speed > 0 && !still;
          var x = wk.x;
          if (moving) { var span2 = W + 32; x = ((wk.x + (wk.dir === 'left' ? -1 : 1) * wk.speed * t / 1000) % span2 + span2) % span2 - 16; }
          var frame = still ? 0 : Math.floor(t / 140) % 4, row = dirRow[wk.dir] || 0;
          wk.layers.forEach(function (ly) { b.drawImage(sheets[ly[0]], ly[1] + frame * 16, ly[2] + row * 32, 16, 32, Math.round(x), wk.y - 16, 16, 32); });
        });
        view.ctx.clearRect(0, 0, view.canvas.width, view.canvas.height);
        view.ctx.drawImage(buf, offset, 0, cropW, H, 0, 0, cropW * view.D, H * view.D);
      }
      animate(el, draw);
      return info;
    });
  }
  function mountScene(el, name, opt) {
    return loadScenes().then(function (all) { var s = all[name]; if (!s) return null; return renderScene(el, s, opt); }).catch(function () { el.textContent = ''; });
  }

  /* ---------- single animated asset ---------- */
  function mountSprite(el) {
    var packId = el.getAttribute('data-pack'), id = el.getAttribute('data-asset');
    return loadMeta(packId).then(function (meta) {
      var a = meta.assets.filter(function (x) { return x.id === id; })[0]; if (!a) return;
      var sheet = meta.sheets.filter(function (s) { return s.id === a.sheet; })[0];
      return loadImage('assets/packs/' + packId + '/' + sheet.file.replace('{variant}', 'summer')).then(function (img) {
        var k = Math.max(2, Math.min(6, Math.floor(Math.min(120 / a.w, 96 / a.h))));
        var v = pixelCanvas(a.w, a.h, k); el.textContent = ''; el.appendChild(v.canvas);
        var frames = (a.frames || [{ x: a.x, y: a.y, duration: 1000 }]).map(function (f) { return [f.x, f.y, f.duration]; });
        animate(el, function (t, still) {
          var f = still ? frames[Math.floor(frames.length / 2)] : frameAt(frames, t, a.loop !== false, 600);
          v.ctx.clearRect(0, 0, v.canvas.width, v.canvas.height);
          v.ctx.drawImage(img, f[0], f[1], a.w, a.h, 0, 0, a.w * v.D, a.h * v.D);
        });
      });
    });
  }
  function mountSheet(el) {
    var packId = el.getAttribute('data-pack'), id = el.getAttribute('data-sheet');
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es, obs) { if (es[0].isIntersecting) { obs.disconnect(); go(); } }, { rootMargin: '300px' }) : null;
    function go() {
      loadMeta(packId).then(function (meta) {
        var s = meta.sheets.filter(function (x) { return x.id === id; })[0];
        return loadImage('assets/packs/' + packId + '/' + s.file.replace('{variant}', 'summer')).then(function (img) {
          var v = pixelCanvas(img.width, img.height, 2); el.textContent = ''; el.appendChild(v.canvas);
          v.ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width * v.D, img.height * v.D);
        });
      });
    }
    if (io) io.observe(el); else go();
  }
  function mountMap(el) {
    var src = el.getAttribute('data-src');
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es, obs) { if (es[0].isIntersecting) { obs.disconnect(); go(); } }, { rootMargin: '300px' }) : null;
    function go() {
      loadImage(src).then(function (img) {
        var k = Math.max(1, Math.floor((el.clientWidth || 380) / img.width)) || 1;
        var v = pixelCanvas(img.width, img.height, Math.min(k, 2)); el.textContent = ''; el.appendChild(v.canvas);
        v.ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width * v.D, img.height * v.D);
      });
    }
    if (io) io.observe(el); else go();
  }

  function init() {
    document.querySelectorAll('[data-scene]').forEach(function (el) {
      var name = el.getAttribute('data-scene');
      var lazy = 'IntersectionObserver' in window && el.getAttribute('data-scale') !== 'hero';
      var go = function () { mountScene(el, name, { mode: el.getAttribute('data-scale') === 'hero' ? 'hero' : null }).then(function (info) { el.dispatchEvent(new CustomEvent('scene-ready', { detail: info })); }); };
      if (lazy) { var io = new IntersectionObserver(function (es, obs) { if (es[0].isIntersecting) { obs.disconnect(); go(); } }, { rootMargin: '200px' }); io.observe(el); } else go();
    });
    document.querySelectorAll('.sprite[data-asset]').forEach(mountSprite);
    document.querySelectorAll('.sheet-view[data-sheet]').forEach(mountSheet);
    document.querySelectorAll('.map-view[data-src]').forEach(mountMap);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  return { loadImage: loadImage, loadMeta: loadMeta, loadScenes: loadScenes, pixelCanvas: pixelCanvas, animate: animate, frameAt: frameAt, renderScene: renderScene, reduce: reduce, url: url };
})();
