/* Tilecraft Art — segmented license key input. Typing advances to the next box, Backspace
 * goes back, and pasting a whole key into any box fills all of them. */
window.TCKeyEntry = (function () {
  'use strict';
  function mount(form, opts) {
    opts = opts || {};
    var segs = Array.prototype.slice.call(form.querySelectorAll('.seg'));
    var err = form.querySelector('.key-error');
    var clean = function (s) { return String(s).toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    var fill = function (raw) {
      raw = clean(raw); if (raw.indexOf('TILE') === 0) raw = raw.slice(4);
      var pos = 0;
      segs.forEach(function (s) { var n = +s.getAttribute('data-len'); s.value = raw.slice(pos, pos + n); pos += n; });
      var firstEmpty = segs.filter(function (s) { return s.value.length < +s.getAttribute('data-len'); })[0];
      (firstEmpty || segs[segs.length - 1]).focus();
    };
    var clearError = function () { form.classList.remove('has-error'); err.textContent = ''; segs.forEach(function (s) { s.removeAttribute('aria-invalid'); }); };
    segs.forEach(function (s, i) {
      var n = +s.getAttribute('data-len');
      s.setAttribute('aria-describedby', err.id || (err.id = 'key-error-' + Math.random().toString(36).slice(2)));
      s.addEventListener('input', function () {
        clearError();
        var v = clean(s.value);
        if (v.length > n) { fill(segs.slice(0, i).map(function (x) { return x.value; }).join('') + v + segs.slice(i + 1).map(function (x) { return x.value; }).join('')); return; }
        s.value = v;
        if (v.length === n && i < segs.length - 1) segs[i + 1].focus();
      });
      s.addEventListener('paste', function (e) {
        var text = (e.clipboardData || window.clipboardData).getData('text');
        if (clean(text).length > n) { e.preventDefault(); clearError(); fill(text); }
      });
      s.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !s.value && i > 0) { e.preventDefault(); segs[i - 1].focus(); segs[i - 1].value = segs[i - 1].value.slice(0, -1); }
        else if (e.key === 'ArrowLeft' && s.selectionStart === 0 && i > 0) { e.preventDefault(); segs[i - 1].focus(); }
        else if (e.key === 'ArrowRight' && s.selectionStart === s.value.length && i < segs.length - 1) { e.preventDefault(); segs[i + 1].focus(); }
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var key = 'TILE' + segs.map(function (s) { return s.value; }).join('');
      var res = window.TCLicense.saveKey(key);
      if (!res.ok) {
        form.classList.add('has-error'); err.textContent = res.message;
        segs.forEach(function (s) { s.setAttribute('aria-invalid', 'true'); });
        form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
        return;
      }
      clearError();
      if (opts.onUnlock) opts.onUnlock(res);
    });
    return { fill: fill, submit: function () { if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true })); }, reset: function () { segs.forEach(function (s) { s.value = ''; }); clearError(); } };
  }
  return { mount: mount };
})();
