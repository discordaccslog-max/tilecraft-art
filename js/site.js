/* Tilecraft Art — shared page behaviour: theme, menu, footer details, prices and buy buttons. */
(function () {
  'use strict';
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : { matches: false, addEventListener: function () {} };

  function theme() { return root.getAttribute('data-theme') || (mq.matches ? 'light' : 'dark'); }
  function labelThemeButtons() {
    var next = theme() === 'light' ? 'dark' : 'light';
    document.querySelectorAll('.theme-toggle').forEach(function (b) { b.setAttribute('aria-label', 'Switch to ' + next + ' theme'); });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.theme-toggle');
    if (!t) return;
    var next = theme() === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('tilecraft.theme', next); } catch (err) { /* storage unavailable: theme still applies to this page */ }
    labelThemeButtons();
  });
  if (mq.addEventListener) mq.addEventListener('change', labelThemeButtons);

  function init() {
    labelThemeButtons();
    var toggle = document.querySelector('.menu-toggle'), nav = document.getElementById('site-nav');
    if (toggle && nav) {
      var close = function () { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); };
      toggle.addEventListener('click', function () { var open = !nav.classList.contains('open'); nav.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { close(); toggle.focus(); } });
      nav.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
    }
    document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

    var cfg = window.TILECRAFT_CONFIG || {}, email = String(cfg.supportEmail || '').trim();
    if (email) {
      document.querySelectorAll('[data-support-email]').forEach(function (el) {
        el.textContent = '';
        var a = document.createElement('a'); a.href = 'mailto:' + email; a.textContent = email;
        el.appendChild(document.createTextNode('Support: ')); el.appendChild(a); el.hidden = false;
      });
      document.querySelectorAll('[data-support-email-block]').forEach(function (el) {
        var a = el.querySelector('[data-support-email-link]'); a.href = 'mailto:' + email; a.textContent = email; el.hidden = false;
      });
    }

    var products = window.TILECRAFT_PRODUCTS || [];
    var byId = {}; products.forEach(function (p) { byId[p.id] = p; });
    document.querySelectorAll('[data-price]').forEach(function (el) {
      var p = byId[el.getAttribute('data-price')]; if (p) el.textContent = '$' + p.price;
    });
    document.querySelectorAll('[data-buy]').forEach(function (el) {
      var p = byId[el.getAttribute('data-buy')];
      el.textContent = '';
      if (!p || !p.checkoutUrl) return;
      var a = document.createElement('a');
      a.className = 'btn btn-primary'; a.href = p.checkoutUrl; a.rel = 'noopener';
      a.textContent = 'Buy now — $' + p.price;
      el.appendChild(a);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
