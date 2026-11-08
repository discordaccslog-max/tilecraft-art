/* Tilecraft Art — order confirmation: creates the license key in the browser, reveals it
 * character by character next to an opening chest, and offers copy and "Open my packs". */
(function () {
  'use strict';
  var box = document.querySelector('[data-thankyou]');
  if (!box) return;
  var code = box.getAttribute('data-thankyou'), product = box.getAttribute('data-product');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* A new key is created when the page loads. If this same tab reloads the page, the key it
   * already showed is kept, so a refresh never replaces a key the buyer may have copied. */
  var key = null, store = 'tilecraft.order.' + product;
  try { key = sessionStorage.getItem(store); } catch (e) { key = null; }
  if (!key || !window.TCLicense.parse(key).ok) { key = window.TCLicense.generate(code); try { sessionStorage.setItem(store, key); } catch (e) { /* keep the key on screen only */ } }

  var out = box.querySelector('[data-key]'), status = box.querySelector('.copy-status');
  if (reduce) out.textContent = key;
  else { var i = 0; (function step() { out.textContent = key.slice(0, ++i); if (i < key.length) setTimeout(step, 45); })(); }

  /* the chest is the gilded chest from Stonehollow, drawn from its real sprite sheet */
  var canvas = box.querySelector('.chest');
  if (canvas) {
    var root = document.body.getAttribute('data-root') || '';
    fetch(root + 'assets/packs/stonehollow/meta.json').then(function (r) { return r.json(); }).then(function (meta) {
      var a = meta.assets.filter(function (x) { return x.id === 'sh-chest-gilded'; })[0], s = meta.sheets.filter(function (x) { return x.id === a.sheet; })[0];
      var img = new Image(); img.onload = function () {
        var ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
        var show = function (f) { ctx.clearRect(0, 0, 32, 32); ctx.drawImage(img, a.frames[f].x, a.frames[f].y, 16, 16, 8, 12, 16, 16); };
        if (reduce) { show(a.frames.length - 1); return; }
        show(0); var f = 0; var t = setInterval(function () { f++; show(f); if (f >= a.frames.length - 1) clearInterval(t); }, 260);
      };
      img.src = root + 'assets/packs/stonehollow/' + s.file;
    }).catch(function () { canvas.hidden = true; });
  }

  box.querySelector('[data-copy]').addEventListener('click', function () {
    var done = function () { status.textContent = 'Copied. Paste it somewhere safe.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(key).then(done, fallback); else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = key; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { status.textContent = 'Select the key above and copy it.'; }
      document.body.removeChild(ta);
    }
  });
  box.querySelector('[data-open]').addEventListener('click', function () {
    try { sessionStorage.setItem('tilecraft.pendingKey', key); } catch (e) { /* the unlock page will ask for the key instead */ }
  });
})();
