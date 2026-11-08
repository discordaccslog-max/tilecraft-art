/* Tilecraft Studio — core: routing, library, asset browser, animation player, palette,
 * downloads and shared helpers used by the playground, character builder and generator. */
(function () {
  'use strict';
  var ROOT = document.body.getAttribute('data-root') || '../';
  var main = document.getElementById('studio-main');
  var crumb = document.querySelector('[data-crumb]');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- small helpers ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c === null || c === undefined) continue; el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return el;
  }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('Your browser is blocking storage, so this could not be saved.'); return false; } }
  };
  var toastTimer = null;
  function toast(msg) { var t = document.querySelector('.toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600); }
  function download(name, blobOrUrl) {
    var a = document.createElement('a'); a.download = name;
    a.href = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    document.body.appendChild(a); a.click(); a.remove();
    if (typeof blobOrUrl !== 'string') setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function canvasBlob(c) { return new Promise(function (res) { c.toBlob(res, 'image/png'); }); }
  function pixelCanvas(w, hh, cssScale) {
    var dpr = window.devicePixelRatio || 1, D = Math.max(1, Math.round(cssScale * dpr));
    var c = h('canvas', { width: w * D, height: hh * D, class: 'px' });
    c.style.width = (w * D / dpr) + 'px'; c.style.height = (hh * D / dpr) + 'px';
    var ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx: ctx, D: D };
  }
  function loadImage(src) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { rej(new Error('Could not load ' + src)); }; i.src = src; }); }
  function supportEmail() { return String((window.TILECRAFT_CONFIG || {}).supportEmail || '').trim(); }
  function reportLink(pack, asset) {
    var email = supportEmail(); if (!email) return null;
    var body = 'Pack: ' + pack.meta.name + '\nAsset ID: ' + asset.id + '\nAsset name: ' + asset.name + '\n\nWhat looks wrong:\n';
    return h('a', { class: 'small', href: 'mailto:' + email + '?subject=' + encodeURIComponent('Problem with asset ' + asset.id) + '&body=' + encodeURIComponent(body) }, 'Report a problem with this asset');
  }

  /* ---------- theme and larger interface ---------- */
  var html = document.documentElement;
  var mq = window.matchMedia('(prefers-color-scheme: light)');
  function theme() { return html.getAttribute('data-theme') || (mq.matches ? 'light' : 'dark'); }
  var themeBtn = document.querySelector('.theme-toggle');
  function labelTheme() { themeBtn.setAttribute('aria-label', 'Switch to ' + (theme() === 'light' ? 'dark' : 'light') + ' theme'); }
  themeBtn.addEventListener('click', function () { var n = theme() === 'light' ? 'dark' : 'light'; html.setAttribute('data-theme', n); try { localStorage.setItem('tilecraft.theme', n); } catch (e) { /* not saved */ } labelTheme(); });
  labelTheme();
  var largeBtn = document.querySelector('[data-large]');
  largeBtn.setAttribute('aria-pressed', String(html.classList.contains('large-ui')));
  largeBtn.addEventListener('click', function () { var on = !html.classList.contains('large-ui'); html.classList.toggle('large-ui', on); largeBtn.setAttribute('aria-pressed', String(on)); try { localStorage.setItem('tilecraft.large', on ? '1' : '0'); } catch (e) { /* not saved */ } });

  /* ---------- data ---------- */
  var catalogP = null, packs = {};
  function catalog() { if (!catalogP) catalogP = fetch(ROOT + 'assets/catalog.json').then(function (r) { return r.json(); }); return catalogP; }
  function loadPack(id) {
    if (packs[id]) return packs[id];
    packs[id] = Promise.all([catalog(), fetch(ROOT + 'assets/packs/' + id + '/meta.json').then(function (r) { if (!r.ok) throw new Error('missing'); return r.json(); })]).then(function (res) {
      var meta = res[1], entry = res[0].packs.filter(function (p) { return p.id === id; })[0];
      var p = { id: id, meta: meta, entry: entry, base: ROOT + 'assets/packs/' + id + '/', byId: {}, sheets: {}, images: {} };
      meta.assets.forEach(function (a) { p.byId[a.id] = a; });
      meta.sheets.forEach(function (s) { p.sheets[s.id] = s; });
      p.variant = meta.variants ? (store.get('tilecraft.variant.' + id, null) || meta.variants[1].id) : null;
      p.recolor = meta.extra && meta.extra.recolor ? store.get('tilecraft.recolor.' + id, null) : null;
      return p;
    });
    return packs[id];
  }
  function sheetSrc(p, sheetId, variant) { return p.base + p.sheets[sheetId].file.replace('{variant}', variant || p.variant || ''); }
  /* Returns an image (or a recoloured canvas) for a sheet in the pack's current variant. */
  function sheetImage(p, sheetId, variant) {
    var v = variant || p.variant, rc = p.recolor && p.meta.extra && p.meta.extra.recolor ? p.recolor : null;
    var key = sheetId + '|' + v + '|' + (rc ? rc.paper + rc.ink : '');
    if (!p.images[key]) p.images[key] = loadImage(sheetSrc(p, sheetId, v)).then(function (img) {
      if (!rc) return img;
      var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      var d = ctx.getImageData(0, 0, c.width, c.height), px = d.data;
      var hex = function (s) { return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]; };
      var from = p.meta.extra.recolor, fp = hex(from.paper), toP = hex(rc.paper), toI = hex(rc.ink);
      for (var i = 0; i < px.length; i += 4) { if (!px[i + 3]) continue; var isPaper = px[i] === fp[0] && px[i + 1] === fp[1] && px[i + 2] === fp[2]; var t = isPaper ? toP : toI; px[i] = t[0]; px[i + 1] = t[1]; px[i + 2] = t[2]; }
      ctx.putImageData(d, 0, 0); return c;
    });
    return p.images[key];
  }
  function frameList(a) { return a.frames ? a.frames : [{ x: a.x, y: a.y, duration: 1000 }]; }
  function drawAsset(ctx, img, a, f, D, dx, dy) { var fr = frameList(a)[f || 0]; ctx.drawImage(img, fr.x, fr.y, a.w, a.h, dx || 0, dy || 0, a.w * D, a.h * D); }
  function assetPNG(p, a, k) {
    return sheetImage(p, a.sheet).then(function (img) {
      var fr = frameList(a), c = document.createElement('canvas'); c.width = a.w * fr.length * k; c.height = a.h * k;
      var ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
      fr.forEach(function (f, i) { ctx.drawImage(img, f.x, f.y, a.w, a.h, i * a.w * k, 0, a.w * k, a.h * k); });
      return canvasBlob(c);
    });
  }
  function variantSuffix(p) { return p.variant ? '-' + p.variant : ''; }

  /* ---------- walkthroughs ---------- */
  function tour(name, steps, force) {
    if (!force && store.get('tilecraft.tour.' + name, false)) return;
    var i = 0, prevFocus = document.activeElement, overlay = h('div', { class: 'tour', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tour-title' });
    var card = h('div', { class: 'tour-card' }); overlay.appendChild(card); document.body.appendChild(overlay);
    var lit = null;
    var finish = function () { if (lit) lit.classList.remove('tour-highlight'); overlay.remove(); store.set('tilecraft.tour.' + name, true); document.removeEventListener('keydown', onKey); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
    var onKey = function (e) { if (e.key === 'Escape') finish(); };
    document.addEventListener('keydown', onKey);
    var show = function () {
      var st = steps[i]; if (lit) lit.classList.remove('tour-highlight');
      lit = st.el && document.querySelector(st.el); if (lit) { lit.classList.add('tour-highlight'); lit.scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' }); }
      card.innerHTML = '';
      card.appendChild(h('p', { class: 'small muted pixel' }, 'Tip ' + (i + 1) + ' of ' + steps.length));
      card.appendChild(h('h2', { id: 'tour-title' }, st.title));
      card.appendChild(h('p', null, st.text));
      var next = h('button', { class: 'btn btn-primary', type: 'button', onclick: function () { if (i < steps.length - 1) { i++; show(); } else finish(); } }, i < steps.length - 1 ? 'Next' : 'Got it');
      card.appendChild(h('div', { class: 'tour-actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: finish }, 'Skip tips'), next));
      /* place the tip beside its target: right, then below, then above, then centred */
      var r = lit ? lit.getBoundingClientRect() : null, cw = Math.min(340, window.innerWidth - 24), ch = 230, vw = window.innerWidth, vh = window.innerHeight, top, left;
      if (r && r.right + 16 + cw < vw) { left = r.right + 16; top = Math.min(Math.max(12, r.top), vh - ch - 12); }
      else if (r && r.bottom + 12 + ch < vh) { top = r.bottom + 12; left = Math.min(Math.max(12, r.left), vw - cw - 12); }
      else if (r && r.top - ch - 12 > 0) { top = r.top - ch - 12; left = Math.min(Math.max(12, r.left), vw - cw - 12); }
      else { top = (vh - ch) / 2; left = (vw - cw) / 2; }
      card.style.top = top + 'px'; card.style.left = left + 'px';
      next.focus();
    };
    show();
  }

  /* ---------- key form ---------- */
  function keyForm(prefix, onDone) {
    var wrap = h('div', { class: 'panel' });
    wrap.innerHTML = '<form class="key-form" data-key-form novalidate><fieldset><legend>Add a license key</legend><div class="key-segments"><span class="key-prefix pixel" aria-hidden="true">TILE</span><span class="dash" aria-hidden="true">–</span>' +
      [['2', 'Product code, 2 characters'], ['5', 'Key part 1, 5 characters'], ['5', 'Key part 2, 5 characters'], ['4', 'Check code, 4 characters']].map(function (s, i) { return '<input class="seg" id="' + prefix + '-' + i + '" data-len="' + s[0] + '" maxlength="' + s[0] + '" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="' + s[1] + '">' + (i < 3 ? '<span class="dash" aria-hidden="true">–</span>' : ''); }).join('') +
      '</div></fieldset><p class="key-error" role="alert"></p><button type="submit" class="btn btn-primary">Unlock</button></form>';
    window.TCKeyEntry.mount(wrap.querySelector('form'), { onUnlock: function (res) { toast('Unlocked: ' + res.packs.length + (res.packs.length > 1 ? ' packs' : ' pack')); onDone(res); } });
    return wrap;
  }

  /* ---------- library ---------- */
  function renderLibrary() {
    crumb.textContent = '';
    document.title = 'Library — Tilecraft Studio';
    return catalog().then(function (cat) {
      var owned = window.TCLicense.unlockedPacks();
      var mine = cat.packs.filter(function (p) { return owned.indexOf(p.id) >= 0; });
      main.innerHTML = '';
      main.appendChild(h('div', { class: 'library-head' }, h('div', null, h('h1', null, 'Your library'), h('p', { class: 'muted' }, mine.length ? 'Choose a pack to preview its assets, try the tools and download the files.' : 'Your library is empty on this device. Enter your license key to open your packs.'))));
      var grid = h('div', { class: 'library-grid' });
      var inv = h('div', { class: 'inventory', role: 'list', 'aria-label': 'Your packs' });
      mine.forEach(function (p) {
        var icon = h('span', { class: 'icon' });
        var slot = h('a', { class: 'slot', href: '#/pack/' + p.id + '/assets', role: 'listitem' }, h('span', { class: 'badge' }, p.tier === 'Studio Edition' ? 'STUDIO' : 'ESS'), icon, h('span', { class: 'name' }, p.name), h('span', { class: 'count' }, p.assets.toLocaleString() + ' assets'));
        inv.appendChild(slot);
        loadImage(ROOT + p.icon.sheet).then(function (img) { var k = Math.max(1, Math.floor(96 / Math.max(p.icon.w, p.icon.h))); var v = pixelCanvas(p.icon.w, p.icon.h, k); v.ctx.drawImage(img, p.icon.x, p.icon.y, p.icon.w, p.icon.h, 0, 0, p.icon.w * v.D, p.icon.h * v.D); icon.appendChild(v.canvas); }).catch(function () { /* icon is decorative */ });
      });
      for (var e = mine.length; e < Math.max(10, Math.ceil(mine.length / 5) * 5); e++) inv.appendChild(h('div', { class: 'slot empty', role: 'listitem', 'aria-label': 'Empty slot' }));
      grid.appendChild(h('div', null, inv));
      var side = h('div');
      side.appendChild(keyForm('lib', function () { renderLibrary(); }));
      var others = cat.packs.filter(function (p) { return owned.indexOf(p.id) < 0; });
      if (others.length) {
        var ul = h('ul', { class: 'more-packs' });
        others.forEach(function (p) { ul.appendChild(h('li', null, h('a', { href: ROOT + 'products/' + (p.product || p.id) + '/' }, p.name), h('span', { class: 'muted small' }, ' · ' + p.tier))); });
        side.appendChild(h('div', { class: 'panel', style: 'margin-top:14px' }, h('h2', { style: 'font-size:1.1rem' }, 'Not in your library yet'), ul));
      }
      if (mine.length) {
        var also = h('input', { type: 'checkbox', id: 'so-all' });
        side.appendChild(h('div', { class: 'panel', style: 'margin-top:14px' }, h('h2', { style: 'font-size:1.1rem' }, 'Sign out on this device'), h('p', { class: 'small muted' }, 'Removes your saved keys from this browser. Your key still works anywhere you enter it.'),
          h('p', null, h('label', { class: 'small' }, also, ' Also remove my saved maps, characters and generator seeds')),
          h('button', { class: 'btn btn-ghost', type: 'button', onclick: function () {
            if (!window.confirm('Remove your saved keys from this browser?')) return;
            window.TCLicense.signOut();
            if (also.checked) { try { Object.keys(localStorage).forEach(function (k) { if (/^tilecraft\.(maps|chars|seeds|current)/.test(k)) localStorage.removeItem(k); }); } catch (err) { /* storage unavailable */ } }
            toast('Signed out on this device'); renderLibrary();
          } }, 'Sign out on this device')));
      }
      grid.appendChild(side);
      main.appendChild(grid);
      main.focus();
    });
  }

  /* ---------- pack views ---------- */
  var TABS = [['assets', 'Assets'], ['animations', 'Animations'], ['palette', 'Palette'], ['playground', 'Map playground'], ['characters', 'Character builder'], ['generator', 'Overworld generator'], ['downloads', 'Downloads']];
  function renderPack(id, tab) {
    if (window.TCLicense.unlockedPacks().indexOf(id) < 0) { location.hash = '#/library'; return; }
    return loadPack(id).then(function (p) {
      var tools = p.entry.tools || [];
      var avail = TABS.filter(function (t) { return ['playground', 'characters', 'generator'].indexOf(t[0]) < 0 || tools.indexOf(t[0]) >= 0; });
      if (!avail.some(function (t) { return t[0] === tab; })) tab = 'assets';
      crumb.textContent = p.meta.name;
      document.title = p.meta.name + ' — ' + avail.filter(function (t) { return t[0] === tab; })[0][1] + ' — Tilecraft Studio';
      main.innerHTML = '';
      var head = h('div', { class: 'pack-head' }, h('h1', null, p.meta.name));
      if (p.meta.variants) {
        var sel = h('select', { 'aria-label': 'Season palette', onchange: function () { p.variant = sel.value; store.set('tilecraft.variant.' + id, sel.value); renderPack(id, tab); } });
        p.meta.variants.forEach(function (v) { sel.appendChild(h('option', { value: v.id, selected: v.id === p.variant }, v.name)); });
        head.appendChild(h('label', { class: 'small muted' }, 'Season ', sel));
      }
      main.appendChild(head);
      var nav = h('nav', { class: 'tabs', 'aria-label': 'Pack tools' });
      avail.forEach(function (t) { nav.appendChild(h('a', { class: 'tab', href: '#/pack/' + id + '/' + t[0], 'aria-current': t[0] === tab ? 'page' : null }, t[1])); });
      main.appendChild(nav);
      var body = h('section', { 'aria-label': avail.filter(function (t) { return t[0] === tab; })[0][1] });
      main.appendChild(body);
      prefetch(p);
      var views = { assets: assetsView, animations: animationsView, palette: paletteView, downloads: downloadsView,
        playground: function (el, pk) { window.TCPlayground.mount(el, pk, API); }, characters: function (el, pk) { window.TCCharacters.mount(el, pk, API); }, generator: function (el, pk) { window.TCGenerator.mount(el, pk, API); } };
      views[tab](body, p);
      main.focus({ preventScroll: true });
    }).catch(function () { main.innerHTML = ''; main.appendChild(h('div', { class: 'panel' }, h('h1', null, 'This pack could not be loaded'), h('p', null, 'Check your connection and try again. Packs you have opened before keep working offline.'), h('a', { href: '#/library' }, 'Back to your library'))); });
  }
  /* fetch every sheet once in the background so the pack keeps working offline */
  function prefetch(p) {
    var run = function () { var vs = p.meta.variants ? p.meta.variants.map(function (v) { return v.id; }) : [null]; p.meta.sheets.forEach(function (s) { vs.forEach(function (v) { fetch(sheetSrc(p, s.id, v)).catch(function () { /* offline */ }); }); }); };
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 4000 }); else setTimeout(run, 1500);
  }

  function bgSwitcher(target, current, onChange) {
    var g = h('div', { class: 'seg-group', role: 'group', 'aria-label': 'Background' });
    [['checker', 'Checker'], ['light', 'Light'], ['dark', 'Dark']].forEach(function (b) {
      g.appendChild(h('button', { type: 'button', 'aria-pressed': String(b[0] === current), onclick: function () { g.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); this.setAttribute('aria-pressed', 'true'); onChange(b[0]); } }, b[1]));
    });
    return g;
  }
  function zoomControl(value, onChange, min, max) {
    var out = h('output', { class: 'pixel' }, value + '×');
    var r = h('input', { type: 'range', min: min || 1, max: max || 8, step: 1, value: value, 'aria-label': 'Zoom', oninput: function () { out.textContent = r.value + '×'; onChange(+r.value); } });
    return h('label', null, 'Zoom', r, out);
  }

  /* ---------- asset browser ---------- */
  function assetsView(el, p) {
    var prefs = store.get('tilecraft.browser', { zoom: 2, bg: 'checker' });
    var cats = []; p.meta.assets.forEach(function (a) { if (cats.indexOf(a.category) < 0) cats.push(a.category); });
    var state = { q: '', cat: null, zoom: prefs.zoom, bg: prefs.bg, limit: 120 };
    var grid = h('div', { class: 'asset-grid' }), more = h('div', { class: 'more-row' }), countEl = h('p', { class: 'small muted', 'aria-live': 'polite' });
    var search = h('input', { type: 'search', placeholder: 'Search by name or ID', 'aria-label': 'Search assets', oninput: function () { state.q = search.value.toLowerCase(); state.limit = 120; draw(); } });
    var bar = h('div', { class: 'toolbar' }, search, zoomControl(state.zoom, function (z) { state.zoom = z; prefs.zoom = z; store.set('tilecraft.browser', prefs); draw(); }), bgSwitcher(grid, state.bg, function (b) { state.bg = b; prefs.bg = b; store.set('tilecraft.browser', prefs); draw(); }));
    el.appendChild(bar);
    if (p.meta.extra && p.meta.extra.recolor) el.appendChild(recolorControl(p, function () { assetsView(clear(el), p); }));
    var chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by category' });
    var chipAll = h('button', { class: 'chip', type: 'button', 'aria-pressed': 'true', onclick: function () { setCat(null, chipAll); } }, 'All (' + p.meta.assets.length + ')');
    chips.appendChild(chipAll);
    cats.forEach(function (c) { var n = p.meta.assets.filter(function (a) { return a.category === c; }).length; var b = h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', onclick: function () { setCat(c, b); } }, c + ' (' + n + ')'); chips.appendChild(b); });
    function setCat(c, btn) { state.cat = c; state.limit = 120; chips.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', String(x === btn)); }); draw(); }
    el.appendChild(chips); el.appendChild(countEl); el.appendChild(grid); el.appendChild(more);
    function draw() {
      var list = p.meta.assets.filter(function (a) { return (!state.cat || a.category === state.cat) && (!state.q || (a.name + ' ' + a.id + ' ' + (a.tags || []).join(' ')).toLowerCase().indexOf(state.q) >= 0); });
      countEl.textContent = list.length + ' of ' + p.meta.assets.length + ' assets';
      grid.innerHTML = '';
      var maxW = 0; list.slice(0, state.limit).forEach(function (a) { maxW = Math.max(maxW, a.w); });
      grid.style.setProperty('--cell', Math.max(110, Math.min(360, maxW * state.zoom + 24)) + 'px');
      list.slice(0, state.limit).forEach(function (a) {
        var art = h('span', { class: 'art bg-' + state.bg });
        var card = h('button', { class: 'asset-card', type: 'button', 'aria-label': a.name + ', ' + a.w + ' by ' + a.h + (a.frames ? ', ' + a.frames.length + ' frames' : ''), onclick: function () { detail(p, a); } }, art, h('span', { class: 'label' }, a.name, h('small', null, a.id)));
        grid.appendChild(card);
        sheetImage(p, a.sheet).then(function (img) { var v = pixelCanvas(a.w, a.h, state.zoom); drawAsset(v.ctx, img, a, 0, v.D); art.appendChild(v.canvas); });
      });
      more.innerHTML = '';
      if (list.length > state.limit) more.appendChild(h('button', { class: 'btn btn-ghost', type: 'button', onclick: function () { state.limit += 240; draw(); } }, 'Show more (' + (list.length - state.limit) + ' left)'));
    }
    draw();
  }
  function clear(el) { el.innerHTML = ''; return el; }
  function recolorControl(p, redraw) {
    var base = p.meta.extra.recolor, cur = p.recolor || base;
    var paper = h('input', { type: 'color', value: cur.paper, 'aria-label': 'Paper colour' }), ink = h('input', { type: 'color', value: cur.ink, 'aria-label': 'Ink colour' });
    var apply = function () { p.recolor = { paper: paper.value, ink: ink.value }; store.set('tilecraft.recolor.' + p.id, p.recolor); redraw(); };
    paper.addEventListener('change', apply); ink.addEventListener('change', apply);
    return h('div', { class: 'recolor' }, h('strong', null, 'Recolour'), h('label', null, 'Paper ', paper), h('label', null, 'Ink ', ink),
      h('button', { type: 'button', class: 'tool-btn', onclick: function () { var t = paper.value; paper.value = ink.value; ink.value = t; apply(); } }, 'Swap'),
      h('button', { type: 'button', class: 'tool-btn', onclick: function () { p.recolor = null; store.set('tilecraft.recolor.' + p.id, null); redraw(); } }, 'Reset'),
      h('span', { class: 'small muted' }, 'Downloads from the studio use these colours; the .zip has the original two.'));
  }
  function detail(p, a) {
    var dlg = h('dialog', { class: 'detail', 'aria-labelledby': 'd-title' });
    var art = h('div', { class: 'detail-art bg-checker' });
    var fr = frameList(a);
    var info = h('dl');
    var add = function (k, v) { info.appendChild(h('dt', null, k)); info.appendChild(h('dd', null, v)); };
    add('ID', a.id); add('Category', a.category); add('Size', a.w + '×' + a.h + ' px'); add('Sheet', p.sheets[a.sheet].name + ' at ' + a.x + ', ' + a.y);
    if (a.tile !== undefined) add('Tile index', String(a.tile));
    if (a.frames) add('Frames', a.frames.length + ' · ' + a.frames.map(function (f) { return f.duration; }).join(' / ') + ' ms · ' + (a.loop ? 'loops' : 'plays once'));
    if (a.nineSlice) add('Nine-slice', 'left ' + a.nineSlice[0] + ', top ' + a.nineSlice[1] + ', right ' + a.nineSlice[2] + ', bottom ' + a.nineSlice[3]);
    if (a.hotspot) add('Hotspot', a.hotspot.join(', '));
    if (a.autotile) add('Autotile', a.autotile.set + ', mask ' + a.autotile.mask);
    var actions = h('div', { class: 'detail-actions' });
    [1, 2, 4].forEach(function (k) { actions.appendChild(h('button', { class: 'tool-btn', type: 'button', onclick: function () { assetPNG(p, a, k).then(function (b) { download(a.id + variantSuffix(p) + (k > 1 ? '@' + k + 'x' : '') + '.png', b); }); } }, 'PNG ' + k + '×')); });
    var rep = reportLink(p, a);
    dlg.appendChild(h('div', { class: 'detail-inner' }, art, h('div', null, h('h2', { id: 'd-title' }, a.name), info, actions, rep ? h('p', { style: 'margin-top:10px' }, rep) : null)));
    dlg.appendChild(h('button', { class: 'icon-btn detail-close', type: 'button', 'aria-label': 'Close', onclick: function () { dlg.close(); } }, '✕'));
    document.body.appendChild(dlg);
    dlg.addEventListener('close', function () { dlg.remove(); });
    sheetImage(p, a.sheet).then(function (img) {
      var k = Math.max(2, Math.min(10, Math.floor(300 / Math.max(a.w, a.h)))), v = pixelCanvas(a.w, a.h, k);
      art.appendChild(v.canvas);
      var f = 0, t0 = performance.now();
      var tick = function (now) {
        if (!dlg.open) return;
        if (fr.length > 1 && !reduce.matches) { var el2 = (now - t0); var total = 0; fr.forEach(function (x) { total += x.duration; }); var u = el2 % total; for (f = 0; f < fr.length; f++) { if (u < fr[f].duration) break; u -= fr[f].duration; } }
        v.ctx.clearRect(0, 0, v.canvas.width, v.canvas.height); drawAsset(v.ctx, img, a, Math.min(f, fr.length - 1), v.D);
        if (fr.length > 1 && !reduce.matches) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }

  /* ---------- animation player ---------- */
  function animationsView(el, p) {
    var list = p.meta.assets.filter(function (a) { return a.frames && a.frames.length > 1; });
    if (!list.length) { el.appendChild(h('p', null, 'This pack has no animations.')); return; }
    var st = { a: list[0], f: 0, playing: !reduce.matches, speed: 1, zoom: 4, bg: 'checker', t: 0, last: 0 };
    var search = h('input', { type: 'search', placeholder: 'Search animations', 'aria-label': 'Search animations' });
    var listEl = h('div', { class: 'anim-list', role: 'list' });
    var stage = h('div', { class: 'player-stage bg-checker', tabindex: '0', 'aria-label': 'Animation preview. Space plays or pauses, arrow keys step frames.' });
    var playBtn = h('button', { class: 'tool-btn', type: 'button' });
    var frameInfo = h('span', { class: 'pixel', 'aria-live': 'polite' });
    var frames = h('div', { class: 'frame-list', role: 'group', 'aria-label': 'Frames' });
    var speed = h('select', { 'aria-label': 'Playback speed' }); [0.25, 0.5, 1, 2, 4].forEach(function (s) { speed.appendChild(h('option', { value: s, selected: s === 1 }, s + '×')); });
    speed.addEventListener('change', function () { st.speed = +speed.value; });
    var renderList = function () {
      var q = search.value.toLowerCase(); listEl.innerHTML = '';
      list.filter(function (a) { return !q || (a.name + a.id).toLowerCase().indexOf(q) >= 0; }).slice(0, 400).forEach(function (a) {
        listEl.appendChild(h('button', { type: 'button', role: 'listitem', 'aria-current': String(a === st.a), onclick: function () { st.a = a; st.f = 0; st.t = 0; renderList(); setup(); } }, a.name + ' · ' + a.frames.length + 'f'));
      });
    };
    search.addEventListener('input', renderList);
    var v = null, img = null;
    var setup = function () {
      sheetImage(p, st.a.sheet).then(function (i) {
        img = i; stage.innerHTML = ''; v = pixelCanvas(st.a.w, st.a.h, st.zoom); stage.appendChild(v.canvas);
        frames.innerHTML = '';
        st.a.frames.forEach(function (f, i2) {
          var fv = pixelCanvas(st.a.w, st.a.h, Math.max(1, Math.floor(32 / Math.max(st.a.w, st.a.h)) || 1)); drawAsset(fv.ctx, img, st.a, i2, fv.D);
          frames.appendChild(h('button', { type: 'button', 'aria-label': 'Frame ' + (i2 + 1) + ', ' + f.duration + ' ms', onclick: function () { st.playing = false; st.f = i2; paint(); } }, fv.canvas, h('div', null, (i2 + 1) + ' · ' + f.duration + 'ms')));
        });
        paint();
      });
    };
    var paint = function () {
      if (!v) return;
      v.ctx.clearRect(0, 0, v.canvas.width, v.canvas.height); drawAsset(v.ctx, img, st.a, st.f, v.D);
      frameInfo.textContent = 'Frame ' + (st.f + 1) + ' / ' + st.a.frames.length + ' · ' + st.a.frames[st.f].duration + ' ms';
      frames.querySelectorAll('button').forEach(function (b, i) { b.setAttribute('aria-current', String(i === st.f)); });
      playBtn.textContent = st.playing ? 'Pause' : 'Play';
    };
    var step = function (d) { st.playing = false; st.f = (st.f + d + st.a.frames.length) % st.a.frames.length; paint(); };
    playBtn.addEventListener('click', function () { st.playing = !st.playing; paint(); });
    stage.addEventListener('keydown', function (e) { if (e.key === ' ') { e.preventDefault(); st.playing = !st.playing; paint(); } else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); } });
    var loop = function (now) {
      if (!document.body.contains(stage)) return;
      if (st.playing && v) { var dt = (now - (st.last || now)) * st.speed; st.t += dt; var d = st.a.frames[st.f].duration; if (st.t >= d) { st.t -= d; st.f = (st.f + 1) % st.a.frames.length; paint(); } }
      st.last = now; requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    var controls = h('div', { class: 'toolbar' }, playBtn, h('button', { class: 'tool-btn', type: 'button', 'aria-label': 'Previous frame', onclick: function () { step(-1); } }, '◀'), h('button', { class: 'tool-btn', type: 'button', 'aria-label': 'Next frame', onclick: function () { step(1); } }, '▶'),
      h('label', null, 'Speed', speed), zoomControl(st.zoom, function (z) { st.zoom = z; setup(); }), bgSwitcher(stage, 'checker', function (b) { stage.className = 'player-stage bg-' + b; }), frameInfo);
    el.appendChild(h('div', { class: 'anim-layout' }, h('div', null, search, listEl), h('div', null, stage, controls, frames)));
    renderList(); setup();
  }

  /* ---------- palette ---------- */
  function paletteView(el, p) {
    var copy = function (hex) { (navigator.clipboard ? navigator.clipboard.writeText(hex) : Promise.reject()).then(function () { toast('Copied ' + hex); }, function () { toast(hex); }); };
    var grid = function (cols) { var g = h('div', { class: 'swatches' }); cols.forEach(function (c) { g.appendChild(h('button', { class: 'swatch', type: 'button', 'aria-label': 'Copy ' + c.hex + (c.name ? ' (' + c.name + ')' : ''), onclick: function () { copy(c.hex); } }, h('span', { class: 'chip-color', style: 'background:' + c.hex }), h('span', null, c.hex))); }); return g; };
    if (p.meta.extra && p.meta.extra.recolor) el.appendChild(recolorControl(p, function () { paletteView(clear(el), p); }));
    el.appendChild(h('p', { class: 'muted' }, 'Click a colour to copy its hex code. ' + p.meta.palette.length + ' colours.'));
    el.appendChild(grid(p.meta.palette));
    if (p.meta.variants) p.meta.variants.forEach(function (v) {
      var uniq = []; v.colors.forEach(function (c) { if (uniq.indexOf(c) < 0) uniq.push(c); });
      el.appendChild(h('h2', { style: 'font-size:1.15rem;margin-top:22px' }, v.name + ' palette (' + uniq.length + ' colours)'));
      el.appendChild(grid(uniq.map(function (c) { return { hex: c }; })));
    });
    var hexTxt = p.meta.palette.map(function (c) { return c.hex.slice(1); }).join('\n') + '\n';
    var gpl = 'GIMP Palette\nName: ' + p.meta.name + '\nColumns: 8\n#\n' + p.meta.palette.map(function (c) { var n = [1, 3, 5].map(function (i) { return parseInt(c.hex.slice(i, i + 2), 16); }); return n.map(function (x) { return String(x).padStart(3); }).join(' ') + '\t' + (c.name || c.hex); }).join('\n') + '\n';
    el.appendChild(h('div', { class: 'toolbar', style: 'margin-top:16px' }, h('button', { class: 'tool-btn', type: 'button', onclick: function () { download(p.id + '.hex', new Blob([hexTxt], { type: 'text/plain' })); } }, 'Download .hex'), h('button', { class: 'tool-btn', type: 'button', onclick: function () { download(p.id + '.gpl', new Blob([gpl], { type: 'text/plain' })); } }, 'Download .gpl')));
  }

  /* ---------- downloads ---------- */
  function downloadsView(el, p) {
    var mb = function (n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; };
    el.appendChild(h('div', { class: 'panel' }, h('h2', { style: 'font-size:1.2rem' }, 'Full pack'), h('p', null, 'Everything in one .zip: ' + p.entry.fileCount.toLocaleString() + ' files, ' + mb(p.entry.zipSize) + '. Includes PNG sheets and individual assets at 1×, 2× and 4×, JSON metadata, ' + (p.meta.sheets.some(function (s) { return s.tileset; }) && (p.meta.autotile.length || p.meta.maps.length) ? 'Tiled tilesets and sample maps, ' : '') + 'palette files, LICENSE.txt and README.txt.'),
      h('a', { class: 'btn btn-primary', href: ROOT + p.entry.zip, download: '' }, 'Download ' + p.id + '.zip')));
    var ul = h('ul', { class: 'dl-list' });
    p.meta.sheets.forEach(function (s) {
      var li = h('li', null, h('strong', null, s.name + (p.variant ? ' (' + p.variant + ')' : '')), h('span', { class: 'muted small' }, s.width + '×' + s.height + ' px'));
      [1, 2, 4].forEach(function (k) {
        li.appendChild(h('button', { class: 'tool-btn', type: 'button', onclick: function () {
          sheetImage(p, s.id).then(function (img) { var c = document.createElement('canvas'); c.width = s.width * k; c.height = s.height * k; var ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0, s.width * k, s.height * k); return canvasBlob(c); }).then(function (b) { download(s.file.split('/').pop().replace('{variant}', p.variant || '').replace('.png', '') + (k > 1 ? '@' + k + 'x' : '') + '.png', b); });
        } }, k + '×'));
      });
      ul.appendChild(li);
    });
    el.appendChild(h('h2', { style: 'font-size:1.2rem;margin-top:22px' }, 'Individual sheets'));
    if (p.meta.variants) el.appendChild(h('p', { class: 'small muted' }, 'Sheets download in the season selected above.'));
    el.appendChild(ul);
    el.appendChild(h('p', { class: 'small' }, h('a', { href: p.base + 'meta.json', download: p.id + '.json' }, 'Download the JSON metadata')));
    el.appendChild(h('p', { class: 'small muted' }, 'Files you download are yours to keep under the license. Once you have opened a pack here, the studio keeps working without an internet connection on this device.'));
  }

  /* ---------- router ---------- */
  function route() {
    var parts = (location.hash || '#/library').replace(/^#\/?/, '').split('/');
    if (parts[0] === 'pack' && parts[1]) return renderPack(parts[1], parts[2] || 'assets');
    return renderLibrary();
  }
  var API = { h: h, store: store, toast: toast, download: download, canvasBlob: canvasBlob, pixelCanvas: pixelCanvas, loadImage: loadImage, sheetImage: sheetImage, drawAsset: drawAsset, frameList: frameList, tour: tour, root: ROOT, reduce: reduce, zoomControl: zoomControl, loadPack: loadPack, variantSuffix: variantSuffix };
  window.TCStudio = API;
  window.addEventListener('hashchange', route);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', route); else route();
  if ('serviceWorker' in navigator && location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () { /* offline support unavailable */ });
  }
})();
