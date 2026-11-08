/* Tilecraft Studio — service worker. Keeps the studio and every pack you have opened
 * available offline. The app shell updates in the background; pack files are cached
 * the first time they load. */
var VERSION = 'tilecraft-studio-v1';
var SHELL = ['./', 'index.html', 'studio.css', 'app.js', 'playground.js', 'characters.js', 'generator.js', 'tiled.js', 'atlas-gen.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  '../css/site.css', '../js/site-config.js', '../js/products.js', '../js/autotile.js', '../js/license.js', '../js/keyentry.js',
  '../fonts/schibsted-grotesk-latin.woff2', '../fonts/pixelify-sans-latin.woff2', '../favicon.svg', '../assets/catalog.json'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== VERSION && k.indexOf('tilecraft-studio') === 0; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  var url = new URL(req.url);
  /* pack files never change for a given version: cache first */
  if (url.pathname.indexOf('/assets/packs/') >= 0) {
    e.respondWith(caches.open(VERSION).then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { if (res.ok) c.put(req, res.clone()); return res; });
      });
    }));
    return;
  }
  /* everything else: network first so updates arrive, cache as the offline fallback */
  e.respondWith(fetch(req).then(function (res) {
    if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined); });
  }));
});
