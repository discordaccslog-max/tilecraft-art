'use strict';
/* Copies only the built site (no build tooling or package files) into .deploy/tilecraft-art,
 * so Vercel serves it as plain static files without trying to run a build.
 * Usage: node build/stage-vercel.js && vercel deploy .deploy/tilecraft-art --prod */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.deploy', 'tilecraft-art');
const SKIP = new Set(['.git', '.deploy', '.review', 'node_modules', 'build', 'package.json', 'package-lock.json', '.gitignore', 'README.md']);

/* keep the .vercel project link from earlier deploys, replace everything else */
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f !== '.vercel') fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
let files = 0;
const copy = (src, dst) => {
  if (fs.statSync(src).isDirectory()) { fs.mkdirSync(dst, { recursive: true }); for (const f of fs.readdirSync(src)) copy(path.join(src, f), path.join(dst, f)); }
  else { fs.copyFileSync(src, dst); files++; }
};
for (const f of fs.readdirSync(ROOT)) if (!SKIP.has(f)) copy(path.join(ROOT, f), path.join(OUT, f));
console.log(`staged ${files} files in ${path.relative(ROOT, OUT)}`);
