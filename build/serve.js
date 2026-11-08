'use strict';
/* Local preview server that mirrors GitHub Pages: the site lives under /tilecraft-art/.
 * Usage: node build/serve.js [port] */
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const BASE = '/tilecraft-art/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.zip': 'application/zip', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
const port = +(process.argv[2] || 4173);
http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/' || u === '/tilecraft-art') { res.writeHead(302, { Location: BASE }); return res.end(); }
  if (!u.startsWith(BASE)) return notFound(res);
  let file = path.join(ROOT, u.slice(BASE.length));
  if (!file.startsWith(ROOT) || /[\\/](node_modules|build|\.git|\.review)([\\/]|$)/.test(file.slice(ROOT.length))) return notFound(res);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return notFound(res);
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Tilecraft Art preview: http://localhost:${port}${BASE}`));
function notFound(res) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); fs.createReadStream(path.join(ROOT, '404.html')).pipe(res); }
