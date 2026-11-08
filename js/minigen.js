/* Tilecraft Art — small Grand Atlas generator demo on the product page. */
(function () {
  'use strict';
  var box = document.querySelector('[data-mini-gen]');
  if (!box) return;
  var PX = window.TCPixel, GEN = window.TCAtlasGen;
  var holder = box.querySelector('.mini-gen-canvas'), input = box.querySelector('#mg-seed');
  PX.loadMeta('grand-atlas').then(function (meta) {
    var sheets = {};
    return Promise.all(meta.sheets.map(function (s) { return PX.loadImage('assets/packs/grand-atlas/' + s.file).then(function (img) { sheets[s.id] = { img: img, cols: s.columns }; }); })).then(function () {
      var W = 40, H = 24, T = 16;
      var scale = Math.max(1, Math.min(3, Math.floor((holder.clientWidth || 640) / (W * T))));
      var v = PX.pixelCanvas(W * T, H * T, scale); holder.appendChild(v.canvas);
      var buf = document.createElement('canvas'); buf.width = W * T; buf.height = H * T; var b = buf.getContext('2d');
      var draw = function () {
        var world = GEN.generate({ seed: input.value || 'atlas', width: W, height: H, land: 0.45, towns: 0.35, rivers: 0.45 });
        var layers = GEN.toLayers(world, meta);
        b.clearRect(0, 0, buf.width, buf.height);
        layers.forEach(function (L) { L.data.forEach(function (t, i) { if (!t) return; var s = sheets[t.sheet]; b.drawImage(s.img, (t.tile % s.cols) * T, Math.floor(t.tile / s.cols) * T, T, T, (i % W) * T, Math.floor(i / W) * T, T, T); }); });
        v.ctx.drawImage(buf, 0, 0, buf.width, buf.height, 0, 0, buf.width * v.D, buf.height * v.D);
        holder.setAttribute('aria-label', 'A small world generated from the seed "' + (input.value || 'atlas') + '"');
      };
      var timer = null;
      input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(draw, 250); });
      var words = ['amber', 'cinder', 'harbor', 'lantern', 'meadow', 'north', 'quiet', 'river', 'silver', 'tide', 'willow', 'zephyr', 'crown', 'fable', 'glass', 'hollow'];
      box.querySelector('[data-mg-random]').addEventListener('click', function () { input.value = words[Math.floor(Math.random() * words.length)] + ' ' + words[Math.floor(Math.random() * words.length)]; draw(); });
      draw();
    });
  });
})();
