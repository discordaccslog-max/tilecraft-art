/* Tilecraft Studio — Grand Atlas overworld generator. */
window.TCGenerator = (function () {
  'use strict';
  var SIZES = [['48x32', 'Small (48×32)'], ['64x44', 'Medium (64×44)'], ['96x64', 'Large (96×64)'], ['128x88', 'Huge (128×88)']];
  var WORDS = ['amber', 'ash', 'briar', 'cinder', 'dawn', 'drift', 'ember', 'fable', 'glass', 'harbor', 'hollow', 'iron', 'juniper', 'lantern', 'marrow', 'north', 'opal', 'pine', 'quiet', 'raven', 'river', 'salt', 'silver', 'thorn', 'tide', 'umber', 'vale', 'willow', 'wren', 'zephyr'];
  function mount(el, p, S) {
    var h = S.h, GEN = window.TCAtlasGen, meta = p.meta, T = meta.tileSize;
    var st = S.store.get('tilecraft.gen.current', null) || { seed: 'tidewater', size: '64x44', land: 50, mountains: 50, forests: 50, rivers: 50, towns: 50 };
    var images = {}, world = null, layers = null, zoom = 2;
    var ready = Promise.all(meta.sheets.map(function (s) { return S.sheetImage(p, s.id).then(function (img) { images[s.id] = img; }); }));
    var stage = h('div', { class: 'gen-stage', role: 'img', 'aria-label': 'Generated world map' });
    var info = h('p', { class: 'small muted', 'aria-live': 'polite' });
    var buf = document.createElement('canvas'), b = buf.getContext('2d');
    var opts = function () { var s = st.size.split('x'); return { seed: st.seed, width: +s[0], height: +s[1], land: st.land / 100, mountains: st.mountains / 100, forests: st.forests / 100, rivers: st.rivers / 100, towns: st.towns / 100 }; };
    var generate = function () {
      S.store.set('tilecraft.gen.current', st);
      ready.then(function () {
        world = GEN.generate(opts()); layers = GEN.toLayers(world, meta);
        buf.width = world.width * T; buf.height = world.height * T;
        b.clearRect(0, 0, buf.width, buf.height);
        layers.forEach(function (L) { L.data.forEach(function (t, i) { if (!t) return; var s = p.sheets[t.sheet]; b.drawImage(images[t.sheet], (t.tile % s.columns) * T, Math.floor(t.tile / s.columns) * T, T, T, (i % world.width) * T, Math.floor(i / world.width) * T, T, T); }); });
        paint();
        var towns = world.markers.filter(function (m) { return m.settlement; }).length;
        info.textContent = 'Seed "' + st.seed + '" · ' + world.width + '×' + world.height + ' tiles · ' + towns + ' settlements · ' + (world.markers.length - towns) + ' landmarks · ' + world.bridges.length + ' bridges';
        stage.setAttribute('aria-label', 'Generated world map for seed ' + st.seed);
      });
    };
    var paint = function () { var v = S.pixelCanvas(buf.width, buf.height, zoom); v.ctx.drawImage(buf, 0, 0, buf.width, buf.height, 0, 0, buf.width * v.D, buf.height * v.D); stage.innerHTML = ''; stage.appendChild(v.canvas); };
    var timer = null;
    var soon = function () { clearTimeout(timer); timer = setTimeout(generate, 220); };
    var seedIn = h('input', { type: 'text', value: st.seed, 'aria-label': 'Seed', maxlength: '60', oninput: function () { st.seed = seedIn.value; soon(); } });
    var sizeSel = h('select', { 'aria-label': 'Map size', onchange: function () { st.size = sizeSel.value; generate(); } });
    SIZES.forEach(function (s) { sizeSel.appendChild(h('option', { value: s[0], selected: s[0] === st.size }, s[1])); });
    var slider = function (key, label) {
      var out = h('output', { class: 'kicker' }, st[key] + '%');
      var r = h('input', { type: 'range', min: 0, max: 100, step: 5, value: st[key], id: 'gen-' + key, oninput: function () { st[key] = +r.value; out.textContent = r.value + '%'; soon(); } });
      return h('div', null, h('label', { for: 'gen-' + key }, label), h('div', { class: 'range-row' }, r, out));
    };
    var savedUl = h('ul', { class: 'saved-list' });
    var listSaved = function () {
      var list = S.store.get('tilecraft.seeds', []); savedUl.innerHTML = '';
      if (!list.length) savedUl.appendChild(h('li', { class: 'muted' }, 'No saved seeds yet.'));
      list.forEach(function (s, i) { savedUl.appendChild(h('li', null, h('span', null, s.seed + ' · ' + s.size), h('button', { class: 'tool-btn', type: 'button', onclick: function () { st = JSON.parse(JSON.stringify(s)); el.innerHTML = ''; S.store.set('tilecraft.gen.current', st); mount(el, p, S); } }, 'Load'), h('button', { class: 'tool-btn', type: 'button', 'aria-label': 'Delete seed ' + s.seed, onclick: function () { list.splice(i, 1); S.store.set('tilecraft.seeds', list); listSaved(); } }, '✕'))); });
    };
    var exportPNG = function (k) { var c = document.createElement('canvas'); c.width = buf.width * k; c.height = buf.height * k; var ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(buf, 0, 0, c.width, c.height); S.canvasBlob(c).then(function (bl) { S.download('world-' + st.seed.replace(/[^\w-]+/g, '-') + (k > 1 ? '@' + k + 'x' : '') + '.png', bl); }); };
    var exportTMX = function () { S.download('world-' + st.seed.replace(/[^\w-]+/g, '-') + '.tmx', new Blob([window.TCTiled.tmx(meta, world.width, world.height, layers, null)], { type: 'application/xml' })); S.toast('Saved .tmx — put it in the pack\'s "tiled" folder to open it in Tiled'); };
    var toPlayground = function () {
      var W = world.width, H = world.height, N = W * H, terrain = {};
      ['shallows', 'land', 'desert', 'snowfield', 'hills', 'forest', 'mountains', 'river', 'road'].forEach(function (k) { var src = world[k]; terrain[k] = Array.prototype.join.call(src, ''); });
      var objects = new Array(N).fill(null);
      var put = function (id, x, y) { var a = p.byId[id]; if (a) objects[y * W + x] = { s: a.sheet, t: a.tile }; };
      world.bridges.forEach(function (bg) { put(bg.horizontal ? 'ga-bridge-h' : 'ga-bridge-v', bg.x, bg.y); });
      world.markers.forEach(function (m) { put('ga-marker-' + m.kind, m.x, m.y); });
      world.sea.forEach(function (m) { put('ga-sea-' + m.kind, m.x, m.y); });
      window.TCPlayground.openMap(p.id, { w: W, h: H, name: 'World ' + st.seed, ground: new Array(N).fill('ga-ocean'), terrain: terrain, objects: objects, overlay: new Array(N).fill(null) }, S);
    };
    var randomSeed = function () { st.seed = WORDS[Math.floor(Math.random() * WORDS.length)] + ' ' + WORDS[Math.floor(Math.random() * WORDS.length)]; seedIn.value = st.seed; generate(); };
    var controls = h('div', { class: 'gen-controls' },
      h('fieldset', { id: 'gen-seed' }, h('legend', null, 'Seed'), seedIn, h('div', { class: 'toolbar', style: 'margin-top:8px' }, h('button', { class: 'tool-btn', type: 'button', onclick: randomSeed }, 'Random seed'), h('button', { class: 'tool-btn', type: 'button', onclick: generate }, 'Regenerate'))),
      h('fieldset', { id: 'gen-sliders' }, h('legend', null, 'World'), h('label', null, 'Size', sizeSel), slider('land', 'Land'), slider('mountains', 'Mountains'), slider('forests', 'Forests'), slider('rivers', 'Rivers'), slider('towns', 'Towns and landmarks')),
      h('fieldset', { id: 'gen-export' }, h('legend', null, 'Save and export'),
        h('div', { class: 'toolbar' }, h('button', { class: 'tool-btn', type: 'button', onclick: function () { var list = S.store.get('tilecraft.seeds', []); list = list.filter(function (s) { return !(s.seed === st.seed && s.size === st.size); }); list.unshift(JSON.parse(JSON.stringify(st))); if (S.store.set('tilecraft.seeds', list.slice(0, 40))) S.toast('Seed saved in this browser'); listSaved(); } }, 'Save seed'),
          h('button', { class: 'tool-btn', type: 'button', onclick: function () { exportPNG(1); } }, 'PNG 1×'), h('button', { class: 'tool-btn', type: 'button', onclick: function () { exportPNG(2); } }, 'PNG 2×'), h('button', { class: 'tool-btn', type: 'button', onclick: exportTMX }, 'Tiled .tmx'),
          h('button', { class: 'tool-btn', type: 'button', onclick: toPlayground }, 'Open in map playground')), savedUl));
    var zoomRow = h('div', { class: 'toolbar' }, S.zoomControl(zoom, function (z) { zoom = z; paint(); }, 1, 4), h('button', { class: 'tool-btn', type: 'button', onclick: function () { tourIt(true); } }, 'Tips'));
    el.appendChild(h('div', { class: 'gen-layout' }, controls, h('div', null, zoomRow, stage, info)));
    var tourIt = function (force) {
      S.tour('generator', [
        { el: '#gen-seed', title: 'Every world has a seed', text: 'Type any word or phrase. The same seed and settings always make the same world, so you can come back to it.' },
        { el: '#gen-sliders', title: 'Shape the world', text: 'Adjust land, mountains, forests, rivers and towns. The map redraws as you move the sliders.' },
        { el: '#gen-export', title: 'Keep what you like', text: 'Save seeds in this browser, export a PNG or a Tiled map, or open the world in the map playground to edit it by hand.' }
      ], force);
    };
    listSaved(); generate(); ready.then(function () { tourIt(false); });
  }
  return { mount: mount };
})();
