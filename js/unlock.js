/* Tilecraft Art — unlock page. */
(function () {
  'use strict';
  var form = document.querySelector('[data-key-form]');
  if (!form) return;
  var success = document.querySelector('.unlock-success');
  var names = { interface: 'Interface Essentials', meadowlands: 'Meadowlands Tileset', effects: 'Effects & Particles', stonehollow: 'Stonehollow Dungeon Tileset', hearthvale: 'Hearthvale Town Tileset', 'character-kit': 'Modular Character Kit', 'ink-edition': 'Ink Edition: 1-Bit World Kit', 'four-seasons': 'Four Seasons Terrain Studio', 'grand-atlas': 'Grand Atlas: Overworld Studio' };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function burst(canvas) {
    var ctx = canvas.getContext('2d'), colors = ['#3fd1bd', '#ffe27c', '#ffffff', '#ef6b98'];
    var parts = []; for (var i = 0; i < 18; i++) { var a = i / 18 * Math.PI * 2; parts.push({ a: a, s: 9 + (i % 3) * 5, c: colors[i % 4] }); }
    var drawGem = function (t) {
      ctx.clearRect(0, 0, 64, 64);
      ctx.fillStyle = '#1f8f84'; ctx.fillRect(26, 24, 12, 16); ctx.fillStyle = '#3fd1bd'; ctx.fillRect(24, 26, 16, 12); ctx.fillRect(28, 22, 8, 20); ctx.fillStyle = '#fff7e6'; ctx.fillRect(28, 26, 3, 2);
      parts.forEach(function (p) { var r = p.s * t; var x = Math.round(32 + Math.cos(p.a) * r), y = Math.round(32 + Math.sin(p.a) * r); if (t < 1) { ctx.fillStyle = p.c; ctx.fillRect(x, y, 2, 2); } });
    };
    if (reduce) { drawGem(1); return; }
    var start = performance.now();
    (function frame(now) { var t = Math.min(1, (now - start) / 700); drawGem(t < 1 ? Math.round(t * 8) / 8 : 1); if (t < 1) requestAnimationFrame(frame); })(start);
  }
  var entry = window.TCKeyEntry.mount(form, {
    onUnlock: function (res) {
      var all = window.TCLicense.unlockedPacks();
      success.querySelector('[data-unlocked-list]').textContent = 'This key unlocks ' + res.packs.map(function (p) { return names[p] || p; }).join(', ') + '.' + (all.length > res.packs.length ? ' Your library now has ' + all.length + ' packs.' : '') + (res.notSaved ? ' Your browser is blocking storage, so the library will only stay unlocked until you close this tab.' : '');
      success.hidden = false; success.classList.add('reveal');
      burst(success.querySelector('canvas'));
      success.focus();
    }
  });
  var pending = null;
  try { pending = sessionStorage.getItem('tilecraft.pendingKey'); sessionStorage.removeItem('tilecraft.pendingKey'); } catch (e) { pending = null; }
  if (pending) { entry.fill(pending); entry.submit(); }
})();
