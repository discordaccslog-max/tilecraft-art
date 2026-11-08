/* Tilecraft Studio — character builder for the Modular Character Kit and Ink Edition. */
window.TCCharacters = (function () {
  'use strict';
  function mount(el, p, S) {
    var h = S.h, C = p.meta.characters, FW = C.frameWidth, FH = C.frameHeight;
    var listKey = 'tilecraft.chars.' + p.id;
    var layers = C.layers, byId = {}; layers.forEach(function (l) { byId[l.id] = l; });
    var groups = function (cat, build) { var out = []; layers.forEach(function (l) { if (l.category === cat && (!build || !l.build || l.build === build) && out.indexOf(l.group) < 0) out.push(l.group); }); return out; };
    var options = function (cat, group, build) { return layers.filter(function (l) { return l.category === cat && l.group === group && (!l.build || l.build === build); }); };
    var groupName = function (cat, g) { var l = layers.filter(function (x) { return x.category === cat && x.group === g; })[0]; return l ? l.groupName : g; };
    var builds = C.builds.map(function (b) { return b.id; });
    var pickFirst = function (cat, g, build, opt) { var o = options(cat, g, build); return (opt && o.filter(function (x) { return x.option === opt; })[0]) || o[0]; };
    var defaults = function () {
      var b = builds[0];
      return { build: b, body: pickFirst('body', 'body-' + b, b).option, outfit: groups('outfit', b)[0], outfitOpt: pickFirst('outfit', groups('outfit', b)[0], b).option, hair: groups('hair')[0], hairOpt: pickFirst('hair', groups('hair')[0]).option, acc: {}, anim: 'walk' };
    };
    var st = S.store.get('tilecraft.char.current.' + p.id, null) || defaults();
    var undo = [], redo = [];
    var change = function (fn) { undo.push(JSON.stringify(st)); if (undo.length > 80) undo.shift(); redo.length = 0; fn(); S.store.set('tilecraft.char.current.' + p.id, st); build(); };
    var resolve = function () {
      var out = [];
      var body = pickFirst('body', 'body-' + st.build, st.build, st.body); if (body) out.push(body);
      if (st.outfit) { var o = pickFirst('outfit', st.outfit, st.build, st.outfitOpt); if (o) out.push(o); }
      if (st.hair) { var hr = pickFirst('hair', st.hair, null, st.hairOpt); if (hr) out.push(hr); }
      Object.keys(st.acc).forEach(function (g) { if (st.acc[g]) { var a = pickFirst('accessory', g, st.build, st.acc[g]); if (a) out.push(a); } });
      return out;
    };
    var images = {};
    var sheetsNeeded = {}; layers.forEach(function (l) { sheetsNeeded[l.sheet] = 1; });
    var ready = Promise.all(Object.keys(sheetsNeeded).map(function (s) { return S.sheetImage(p, s).then(function (img) { images[s] = img; }); }));

    /* ---------- controls ---------- */
    var controls = h('div', { class: 'cb-controls' });
    var preview = h('div', { class: 'cb-preview' });
    var stages = {};
    ['down', 'left', 'right', 'up'].forEach(function (d) { var stg = h('div', { class: 'stage bg-checker' }); stages[d] = stg; preview.appendChild(h('figure', null, stg, h('figcaption', null, 'Facing ' + d))); });
    var zoom = 5;
    var build = function () {
      controls.innerHTML = '';
      var fs = function (legend) { var f = h('fieldset', null, h('legend', null, legend)); controls.appendChild(f); return f; };
      var swatchRow = function (opts, current, onPick, label) {
        var row = h('div', { class: 'swatch-row', role: 'group', 'aria-label': label });
        opts.forEach(function (o) { row.appendChild(h('button', { type: 'button', 'aria-pressed': String(o.option === current), 'aria-label': o.optionName, title: o.optionName, style: 'background:' + (o.swatch || swatchFor(o)), onclick: function () { onPick(o.option); } })); });
        return row;
      };
      var fb = fs('Body');
      var bsel = h('div', { class: 'seg-group', role: 'group', 'aria-label': 'Body build' });
      C.builds.forEach(function (b) { bsel.appendChild(h('button', { type: 'button', 'aria-pressed': String(b.id === st.build), onclick: function () { change(function () { st.build = b.id; }); } }, b.name)); });
      fb.appendChild(bsel);
      fb.appendChild(swatchRow(options('body', 'body-' + st.build, st.build), st.body, function (o) { change(function () { st.body = o; }); }, 'Skin tone'));
      var fo = fs('Outfit');
      var osel = h('select', { 'aria-label': 'Outfit style', onchange: function () { change(function () { st.outfit = osel.value || null; }); } });
      osel.appendChild(h('option', { value: '' }, 'None'));
      groups('outfit', st.build).forEach(function (g) { osel.appendChild(h('option', { value: g, selected: g === st.outfit }, groupName('outfit', g))); });
      fo.appendChild(osel);
      if (st.outfit) fo.appendChild(swatchRow(options('outfit', st.outfit, st.build), st.outfitOpt, function (o) { change(function () { st.outfitOpt = o; }); }, 'Outfit colourway'));
      var fh = fs('Hair');
      var hsel = h('select', { 'aria-label': 'Hairstyle', onchange: function () { change(function () { st.hair = hsel.value || null; }); } });
      hsel.appendChild(h('option', { value: '' }, 'None'));
      groups('hair').forEach(function (g) { hsel.appendChild(h('option', { value: g, selected: g === st.hair }, groupName('hair', g))); });
      fh.appendChild(hsel);
      if (st.hair) fh.appendChild(swatchRow(options('hair', st.hair), st.hairOpt, function (o) { change(function () { st.hairOpt = o; }); }, 'Hair colour'));
      var fa = fs('Accessories');
      groups('accessory', st.build).forEach(function (g) {
        var opts = options('accessory', g, st.build), id = 'acc-' + g;
        var cb = h('input', { type: 'checkbox', id: id, checked: !!st.acc[g], onchange: function () { change(function () { if (cb.checked) st.acc[g] = opts[0].option; else delete st.acc[g]; }); } });
        var row = h('div', { style: 'margin:4px 0' }, h('label', { for: id }, cb, ' ', groupName('accessory', g)));
        if (st.acc[g] && opts.length > 1) row.appendChild(swatchRow(opts, st.acc[g], function (o) { change(function () { st.acc[g] = o; }); }, groupName('accessory', g) + ' colour'));
        fa.appendChild(row);
      });
      var fx = fs('Preview');
      var asel = h('div', { class: 'seg-group', role: 'group', 'aria-label': 'Animation' });
      ['walk', 'idle'].forEach(function (a) { asel.appendChild(h('button', { type: 'button', 'aria-pressed': String(a === st.anim), onclick: function () { st.anim = a; build(); } }, a === 'walk' ? 'Walk' : 'Idle')); });
      fx.appendChild(asel);
      fx.appendChild(S.zoomControl(zoom, function (z) { zoom = z; draw(true); }, 2, 8));
      draw(true);
    };
    var swatchFor = function () { return '#888'; };
    var views = {};
    var draw = function (rebuild) {
      ready.then(function () {
        var stack = resolve(), anim = C.animations[st.anim];
        ['down', 'left', 'right', 'up'].forEach(function (d, row) {
          if (rebuild || !views[d]) { views[d] = S.pixelCanvas(FW, FH, zoom); stages[d].innerHTML = ''; stages[d].appendChild(views[d].canvas); stages[d].setAttribute('role', 'img'); }
          stages[d].setAttribute('aria-label', 'Character facing ' + d + ', ' + st.anim + ' animation');
          var v = views[d], t = performance.now(), total = anim.durations.reduce(function (a, b) { return a + b; }, 0), u = S.reduce.matches ? 0 : t % total, f = 0;
          for (f = 0; f < anim.frames; f++) { if (u < anim.durations[f]) break; u -= anim.durations[f]; }
          f = Math.min(f, anim.frames - 1);
          v.ctx.clearRect(0, 0, v.canvas.width, v.canvas.height);
          stack.forEach(function (l) { v.ctx.drawImage(images[l.sheet], l.x + (anim.column + f) * FW, l.y + row * FH, FW, FH, 0, 0, FW * v.D, FH * v.D); });
        });
      });
    };
    var loop = function () { if (!document.body.contains(preview)) return; if (!S.reduce.matches) draw(false); setTimeout(function () { requestAnimationFrame(loop); }, 70); };

    /* ---------- actions ---------- */
    var randomize = function () { change(function () {
      var r = function (a) { return a[Math.floor(Math.random() * a.length)]; };
      st.build = r(builds); st.body = r(options('body', 'body-' + st.build, st.build)).option;
      st.outfit = r(groups('outfit', st.build)); st.outfitOpt = r(options('outfit', st.outfit, st.build)).option;
      st.hair = r(groups('hair')); st.hairOpt = r(options('hair', st.hair)).option;
      st.acc = {}; var ag = groups('accessory', st.build); if (ag.length && Math.random() < 0.7) { var g = r(ag); st.acc[g] = r(options('accessory', g, st.build)).option; }
    }); };
    var exportSheet = function (k) {
      ready.then(function () {
        var stack = resolve(), cols = C.layerSize.columns, rows = C.layerSize.rows;
        var c = document.createElement('canvas'); c.width = cols * FW * k; c.height = rows * FH * k; var ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
        stack.forEach(function (l) { ctx.drawImage(images[l.sheet], l.x, l.y, cols * FW, rows * FH, 0, 0, cols * FW * k, rows * FH * k); });
        var name = (nameIn.value || 'character').replace(/[^\w-]+/g, '-');
        S.canvasBlob(c).then(function (b) { S.download(name + (k > 1 ? '@' + k + 'x' : '') + '.png', b); });
        if (k === 1) {
          var frames = {}; C.directions.forEach(function (d, row) { Object.keys(C.animations).forEach(function (a) { var an = C.animations[a]; frames[a + '_' + d] = []; for (var f = 0; f < an.frames; f++) frames[a + '_' + d].push({ x: (an.column + f) * FW, y: row * FH, w: FW, h: FH, duration: an.durations[f] }); }); });
          S.download(name + '.json', new Blob([JSON.stringify({ image: name + '.png', frameWidth: FW, frameHeight: FH, layers: stack.map(function (l) { return l.id; }), animations: frames }, null, 1)], { type: 'application/json' }));
        }
      });
    };
    var nameIn = h('input', { type: 'text', value: st.name || 'My character', 'aria-label': 'Character name', maxlength: '40' });
    var savedUl = h('ul', { class: 'saved-list' });
    var listSaved = function () {
      var list = S.store.get(listKey, []); savedUl.innerHTML = '';
      if (!list.length) savedUl.appendChild(h('li', { class: 'muted' }, 'No saved characters yet.'));
      list.forEach(function (c, i) { savedUl.appendChild(h('li', null, h('span', null, c.name), h('button', { class: 'tool-btn', type: 'button', onclick: function () { change(function () { st = JSON.parse(JSON.stringify(c.state)); }); nameIn.value = c.name; } }, 'Open'), h('button', { class: 'tool-btn', type: 'button', 'aria-label': 'Delete ' + c.name, onclick: function () { if (!window.confirm('Delete "' + c.name + '"?')) return; list.splice(i, 1); S.store.set(listKey, list); listSaved(); } }, '✕'))); });
    };
    var save = function () { var list = S.store.get(listKey, []), n = (nameIn.value || 'My character').trim(); st.name = n; list = list.filter(function (c) { return c.name !== n; }); list.unshift({ name: n, state: JSON.parse(JSON.stringify(st)) }); if (S.store.set(listKey, list.slice(0, 40))) S.toast('Saved "' + n + '" in this browser'); listSaved(); };
    var undoBtn = h('button', { class: 'tool-btn', type: 'button', title: 'Undo (Ctrl+Z)', onclick: function () { if (!undo.length) return; redo.push(JSON.stringify(st)); st = JSON.parse(undo.pop()); build(); } }, 'Undo');
    var redoBtn = h('button', { class: 'tool-btn', type: 'button', title: 'Redo (Ctrl+Shift+Z)', onclick: function () { if (!redo.length) return; undo.push(JSON.stringify(st)); st = JSON.parse(redo.pop()); build(); } }, 'Redo');
    var onKey = function (e) {
      if (!document.body.contains(preview)) { document.removeEventListener('keydown', onKey); return; }
      var tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' && e.target.type === 'text') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? redoBtn : undoBtn).click(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redoBtn.click(); }
      else if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'r' && tag !== 'select') randomize();
    };
    document.addEventListener('keydown', onKey);
    var actions = h('div', { class: 'toolbar', id: 'cb-actions' }, undoBtn, redoBtn, h('button', { class: 'tool-btn', type: 'button', title: 'Randomize (R)', onclick: randomize }, 'Randomize'), h('button', { class: 'tool-btn', type: 'button', onclick: function () { tourIt(true); } }, 'Tips'));
    var exportPanel = h('div', { class: 'panel', id: 'cb-export', style: 'margin-top:14px' }, h('h3', { style: 'font-size:1rem' }, 'Save and export'), h('p', null, nameIn),
      h('div', { class: 'toolbar' }, h('button', { class: 'tool-btn', type: 'button', onclick: save }, 'Save'), h('button', { class: 'tool-btn', type: 'button', onclick: function () { exportSheet(1); } }, 'Sheet 1× + JSON'), h('button', { class: 'tool-btn', type: 'button', onclick: function () { exportSheet(2); } }, 'Sheet 2×'), h('button', { class: 'tool-btn', type: 'button', onclick: function () { exportSheet(4); } }, 'Sheet 4×')),
      h('p', { class: 'small muted' }, 'The sheet has 4 rows (down, left, right, up) and 6 columns: walk frames 1–4, then idle frames 1–2, at ' + FW + '×' + FH + ' per frame.'), savedUl);
    el.appendChild(actions);
    el.appendChild(h('div', { class: 'cb-layout' }, controls, h('div', null, preview, exportPanel)));
    var tourIt = function (force) {
      S.tour('characters', [
        { el: '.cb-controls', title: 'Build from layers', text: 'Choose a body and skin tone, then an outfit, hairstyle and accessories. Every layer lines up in every frame.' },
        { el: '.cb-preview', title: 'Four directions', text: 'The preview plays the walk or idle cycle facing down, left, right and up.' },
        { el: '#cb-actions', title: 'Undo and randomize', text: 'Undo with Ctrl+Z, redo with Ctrl+Shift+Z, and press R for a random character.' },
        { el: '#cb-export', title: 'Export your character', text: 'Download the finished sprite sheet at 1×, 2× or 4×, with a JSON file of frame positions. Saved characters stay in this browser.' }
      ], force);
    };
    build(); listSaved(); requestAnimationFrame(loop); ready.then(function () { tourIt(false); });
  }
  return { mount: mount };
})();
