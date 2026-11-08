'use strict';
/* Creates a new administrator key that unlocks every pack, and stores only its SHA-256
 * fingerprint in js/license.js. The key itself is printed once and never written to disk,
 * so keep it somewhere safe. Running this again replaces the old admin key, which then
 * stops working on any device the next time the page loads.  Usage: node build/admin-key.js */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FILE = path.join(__dirname, '..', 'js', 'license.js');
const L = require(FILE);

let body = '';
while (body.length < 10) { const n = crypto.randomBytes(1)[0]; if (n < 248) body += L.ALPHABET[n % 31]; }
const code = L.ADMIN_CODE;
const key = ['TILE', code, body.slice(0, 5), body.slice(5), L.checksum(code, body)].join('-');
const hash = crypto.createHash('sha256').update(key).digest('hex');
if (L.sha256(key) !== hash) throw new Error('license.js sha256 does not match Node crypto');

const src = fs.readFileSync(FILE, 'utf8');
const next = src.replace(/(var ADMIN = \{ code: 'AD', hash: ')[^']*(' \};)/, `$1${hash}$2`);
if (next === src) throw new Error('could not find the ADMIN hash line in js/license.js');
fs.writeFileSync(FILE, next);

delete require.cache[require.resolve(FILE)];
const check = require(FILE).parse(key);
if (!check.ok || !check.admin) throw new Error('new admin key does not validate');
console.log(`Admin key (unlocks ${check.packs.length} packs): ${key}`);
