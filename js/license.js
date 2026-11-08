/* Tilecraft Art — license keys, generated and checked entirely in the browser.
 * Format: TILE-<product code>-<5 random>-<5 random>-<4 check>, for example TILE-MD-7KQ4M-X9D2P-H6TR.
 * The alphabet leaves out 0, O, 1, I and L so no character can be mistaken for another. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TCLicense = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  var CODES = { UX: ['interface'], MD: ['meadowlands'], FX: ['effects'], SH: ['stonehollow'], HV: ['hearthvale'], CK: ['character-kit'],
    EB: ['interface', 'meadowlands', 'effects', 'stonehollow', 'hearthvale', 'character-kit'], NK: ['ink-edition'], FS: ['four-seasons'], GA: ['grand-atlas'] };
  var STORE = 'tilecraft.keys';

  function checksum(code, body) {
    var s = 'tilecraft-art|' + code + '|' + body, h1 = 0x811c9dc5, h2 = 0x9e3779b9;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619);
      h2 = Math.imul(h2 ^ c, 0x85ebca6b); h2 ^= h2 >>> 13;
    }
    var v = ((h1 >>> 0) ^ Math.imul(h2 >>> 0, 0x27d4eb2d)) >>> 0;
    var out = '';
    for (var k = 0; k < 4; k++) { out += ALPHABET[v % 31]; v = Math.floor(v / 31); }
    return out;
  }
  function randomBody() {
    var out = '', buf = new Uint32Array(1), cryptoObj = (typeof crypto !== 'undefined') ? crypto : null;
    while (out.length < 10) {
      if (cryptoObj && cryptoObj.getRandomValues) cryptoObj.getRandomValues(buf); else buf[0] = Math.floor(Math.random() * 4294967296);
      var n = buf[0];
      if (n >= 4294967296 - (4294967296 % 31)) continue;
      out += ALPHABET[n % 31];
    }
    return out;
  }
  function generate(code) {
    if (!CODES[code]) throw new Error('Unknown product code');
    var body = randomBody();
    return ['TILE', code, body.slice(0, 5), body.slice(5), checksum(code, body)].join('-');
  }
  /* Accepts pasted keys with spaces, lowercase or missing dashes. */
  function normalize(input) { return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function parse(input) {
    var raw = normalize(input);
    if (raw.indexOf('TILE') === 0) raw = raw.slice(4);
    if (!raw.length) return { ok: false, reason: 'empty', message: 'Enter the key from your order confirmation page.' };
    var bad = raw.match(/[01OIL]/);
    if (bad) return { ok: false, reason: 'confusable', message: 'Keys never contain 0, O, 1, I or L. Check the character "' + bad[0] + '" — it is probably a similar-looking letter or number.' };
    if (raw.length !== 16) return { ok: false, reason: 'length', message: 'That key looks ' + (raw.length < 16 ? 'incomplete' : 'too long') + '. A full key has 16 characters after "TILE", in groups of 2, 5, 5 and 4.' };
    var code = raw.slice(0, 2), body = raw.slice(2, 12), check = raw.slice(12);
    if (!CODES[code]) return { ok: false, reason: 'product', message: 'We don\'t recognise the product part of that key ("' + code + '"). Check the two characters after "TILE".' };
    if (checksum(code, body) !== check) return { ok: false, reason: 'checksum', message: 'That key didn\'t check out — there may be a typo. Compare it character by character with the key you saved.' };
    var key = ['TILE', code, body.slice(0, 5), body.slice(5), check].join('-');
    return { ok: true, key: key, code: code, packs: CODES[code].slice() };
  }
  function storage() { try { return window.localStorage; } catch (e) { return null; } }
  function savedKeys() {
    var s = storage(); if (!s) return [];
    try { var v = JSON.parse(s.getItem(STORE) || '[]'); return Array.isArray(v) ? v.filter(function (k) { return parse(k).ok; }) : []; } catch (e) { return []; }
  }
  function saveKey(key) {
    var p = parse(key); if (!p.ok) return p;
    var keys = savedKeys(); if (keys.indexOf(p.key) < 0) keys.push(p.key);
    var s = storage(); if (s) { try { s.setItem(STORE, JSON.stringify(keys)); } catch (e) { p.notSaved = true; } } else p.notSaved = true;
    return p;
  }
  function unlockedPacks() {
    var set = {};
    savedKeys().forEach(function (k) { parse(k).packs.forEach(function (p) { set[p] = true; }); });
    return Object.keys(set);
  }
  function signOut() { var s = storage(); if (s) try { s.removeItem(STORE); } catch (e) { /* storage unavailable */ } }
  return { ALPHABET: ALPHABET, CODES: CODES, generate: generate, parse: parse, normalize: normalize, checksum: checksum, savedKeys: savedKeys, saveKey: saveKey, unlockedPacks: unlockedPacks, signOut: signOut };
});
