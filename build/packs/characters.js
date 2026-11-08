'use strict';
const { Raster, Palette, hash2, mod } = require('../lib/raster.js');
const { Pack } = require('../lib/pack.js');
const FG = require('../lib/figure.js');
const { L } = FG;

const RAMPS = {
  skin1: ['#ffe2cc', '#f0c3a1', '#d49a7a'], skin2: ['#f5cda2', '#e1aa7c', '#bc835c'], skin3: ['#ddaa78', '#c08756', '#97663f'],
  skin4: ['#b67e55', '#97623f', '#73472e'], skin5: ['#8c5a3c', '#71452d', '#53321f'], skin6: ['#6a4231', '#543224', '#3c2219'],
  hblack: ['#5c5772', '#3a3549', '#26212f'], hbrown: ['#9b6b46', '#6f4a31', '#4b3122'], hauburn: ['#d3733f', '#a44e2c', '#713222'],
  hblonde: ['#f6dc8b', '#d9af5a', '#a77e37'], hsilver: ['#efedf4', '#bcb9cc', '#86839c'], hteal: ['#82d6c6', '#40998f', '#286a62'],
  cream: ['#f4f1ea', '#d9d1c1', '#a69b89'], slate: ['#9ba2b6', '#6c738a', '#474c61'], red: ['#e56b60', '#b9423e', '#7e2b2e'],
  green: ['#90cf74', '#5a9c4e', '#376837'], blue: ['#7aa9e8', '#4b73c1', '#2f4a86'], gold: ['#f4cc5f', '#cf9a34', '#946525'],
  purple: ['#b392e0', '#8462b9', '#574086'], leather: ['#c18b5b', '#8f603c', '#5e3d27']
};
const entries = [['out', '#1f1a26'], ['blush', '#e8847f'], ['metal1', '#dde1e9'], ['metal2', '#9ca4b6']];
for (const [k, r] of Object.entries(RAMPS)) r.forEach((hex, i) => entries.push([`${k}${'abc'[i]}`, hex]));
const P = new Palette(entries);
const ramp = k => [P[k + 'a'], P[k + 'b'], P[k + 'c']];

const SKINS = [['skin1', 'Porcelain'], ['skin2', 'Peach'], ['skin3', 'Honey'], ['skin4', 'Amber'], ['skin5', 'Umber'], ['skin6', 'Espresso']];
const HAIRCOLORS = [['hblack', 'Ink black'], ['hbrown', 'Chestnut'], ['hauburn', 'Copper'], ['hblonde', 'Wheat'], ['hsilver', 'Silver'], ['hteal', 'Teal dye']];
const BUILDS = [['slim', 'Slim'], ['sturdy', 'Sturdy']];

/* ---------- body ---------- */
function bodyLayer(build, skinKey) {
  const sk = ramp(skinKey), shirt = ramp('cream'), shorts = ramp('slate'), shoe = ramp('leather');
  return FG.layerFrames(build, (dir, fig) => FG.paint(fig, (l, s, x, y) => {
    const dy = fig.dy;
    switch (l) {
      case L.OUT: return P.out;
      case L.EYE: return P.out;
      case L.BLUSH: return P.blush;
      case L.HEAD: case L.HAND: case L.SHIN: return sk[s];
      case L.FARHAND: return sk[2];
      case L.ARM: return y <= 17 + dy ? shirt[s] : sk[s];
      case L.FARARM: return y <= 17 + dy ? shirt[2] : sk[2];
      case L.TORSO: return shirt[s];
      case L.THIGH: return shorts[s];
      case L.FARLEG: return y <= 24 + dy ? shorts[2] : sk[2];
      case L.FOOT: return shoe[s];
      case L.FARFOOT: return shoe[2];
    }
    return 0;
  }));
}

/* ---------- outfits ---------- */
/* Adds pixels outside the body (skirts, robes, cloaks) and outlines only the new silhouette. */
function extend(r, fig, pixels) {
  for (const [x, y, c] of pixels) if (x >= 0 && x < 16 && y >= 0 && y < 32) r.set(x, y, c);
  const src = r.clone();
  for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
    if (src.get(x, y)) continue;
    const lab = fig.get(x, y);
    if (lab && lab !== L.OUT) continue;
    if (src.get(x - 1, y) || src.get(x + 1, y) || src.get(x, y - 1) || src.get(x, y + 1)) r.set(x, y, P.out);
  }
  return r;
}
function bodyBounds(fig, y) {
  let x0 = 99, x1 = -1;
  for (let x = 0; x < 16; x++) { const l = fig.get(x, y); if (l && l !== L.OUT) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } }
  return [x0, x1];
}
const OUTFITS = {
  tunic: { name: 'Tunic', colorways: [['green', 'leather', 'gold'], ['blue', 'slate', 'leather'], ['red', 'leather', 'gold']] },
  dress: { name: 'Dress', colorways: [['purple', 'cream', 'gold'], ['blue', 'cream', 'leather'], ['red', 'cream', 'gold']] },
  robe: { name: 'Robe', colorways: [['blue', 'gold', 'cream'], ['purple', 'gold', 'cream'], ['slate', 'red', 'cream']] },
  overalls: { name: 'Overalls', colorways: [['blue', 'cream', 'leather'], ['green', 'red', 'leather'], ['leather', 'cream', 'slate']] },
  vest: { name: 'Vest', colorways: [['red', 'slate', 'gold'], ['green', 'leather', 'gold'], ['purple', 'slate', 'metal']] },
  cloak: { name: 'Cloak', colorways: [['cream', 'green', 'gold'], ['slate', 'red', 'gold'], ['cream', 'purple', 'metal']] },
  apron: { name: 'Apron', colorways: [['red', 'slate', 'cream'], ['blue', 'leather', 'cream'], ['green', 'slate', 'cream']] },
  guard: { name: 'Guard', colorways: [['blue', 'slate', 'leather'], ['red', 'leather', 'leather'], ['green', 'slate', 'leather']] },
  jacket: { name: 'Jacket', colorways: [['leather', 'slate', 'cream'], ['blue', 'leather', 'gold'], ['purple', 'slate', 'cream']] },
  coat: { name: 'Long coat', colorways: [['slate', 'leather', 'gold'], ['red', 'slate', 'gold'], ['green', 'leather', 'cream']] }
};
function rampOrMetal(k) { return k === 'metal' ? [P.metal1, P.metal2, P.metal2] : ramp(k); }
function outfitLayer(build, style, cw) {
  const [A, B, C] = cw.map(rampOrMetal);
  const shirt = ramp('cream'), boot = ramp('leather');
  return FG.layerFrames(build, (dir, fig) => {
    const dy = fig.dy, front = dir === 'down', side = dir === 'left', back = dir === 'up';
    const waist = 22 + dy;
    const [tx0, tx1] = (() => { let a = 99, b = -1; for (let x = 0; x < 16; x++) if (fig.get(x, 19 + dy) === L.TORSO) { a = Math.min(a, x); b = Math.max(b, x); } return [a, b]; })();
    const mid = (tx0 + tx1) / 2;
    let r = FG.paint(fig, (l, s, x, y) => {
      const sleeve = l === L.ARM || l === L.FARARM;
      const far = l === L.FARARM || l === L.FARLEG || l === L.FARFOOT;
      const sh = far ? 2 : s;
      const legUpper = (l === L.THIGH) || (l === L.FARLEG && y <= 24 + dy);
      const leg = l === L.THIGH || l === L.SHIN || l === L.FARLEG;
      const foot = l === L.FOOT || l === L.FARFOOT;
      switch (style) {
        case 'tunic':
          if (l === L.TORSO) return y === waist ? C[sh] : (front && y === 16 + dy && Math.abs(x - mid) < 1) ? A[2] : A[sh];
          if (sleeve) return A[sh];
          if (legUpper) return A[sh];
          if (leg) return B[sh];
          if (foot) return boot[Math.min(2, sh + 1)];
          return 0;
        case 'dress':
          if (l === L.TORSO) return y === waist ? C[sh] : A[sh];
          if (sleeve) return y <= 17 + dy ? A[sh] : 0;
          if (leg) return A[sh];
          if (foot) return C[sh];
          return 0;
        case 'robe':
          if (l === L.TORSO) return y === waist - 1 ? C[sh] : (front && Math.abs(x - mid) < 1 && y > 16 + dy) ? B[1] : A[sh];
          if (sleeve) return A[sh];
          if (l === L.HAND || l === L.FARHAND) return 0;
          if (leg) return A[sh];
          if (foot) return y >= 29 ? B[sh] : A[sh];
          return 0;
        case 'overalls': {
          const bib = front ? (x > tx0 && x < tx1 && y >= 18 + dy) : back ? (y >= 21 + dy) : (y >= 19 + dy);
          const strap = (front || back) && (x === tx0 + 1 || x === tx1 - 1) && y < 18 + dy;
          if (l === L.TORSO) return bib || strap ? A[sh] : B[sh];
          if (sleeve) return y <= 18 + dy ? B[sh] : 0;
          if (leg) return A[sh];
          if (foot) return boot[sh];
          return 0;
        }
        case 'vest': {
          if (l === L.TORSO) {
            if (front && Math.abs(x - mid) < 1) return (y - dy) % 2 ? C[0] : shirt[1];
            if (front || side) return A[sh];
            return A[sh];
          }
          if (sleeve) return shirt[sh];
          if (leg) return B[sh];
          if (foot) return boot[sh];
          return 0;
        }
        case 'cloak':
          if (l === L.TORSO) return front && Math.abs(x - mid) < 2 ? (y === 16 + dy ? C[0] : A[sh]) : B[sh];
          if (sleeve) return B[sh];
          if (leg) return legUpper ? A[sh] : ramp('slate')[sh];
          if (foot) return boot[sh];
          return 0;
        case 'apron': {
          if (l === L.TORSO) return front && x > tx0 && x < tx1 && y >= 18 + dy ? C[sh === 2 ? 1 : 0] : (back && y === waist - 1 ? C[1] : A[sh]);
          if (sleeve) return y <= 18 + dy ? A[sh] : 0;
          if (leg) return front && legUpper ? C[sh === 2 ? 1 : 0] : B[sh];
          if (foot) return boot[sh];
          return 0;
        }
        case 'guard': {
          if (l === L.TORSO) { if (y === waist) return ramp('leather')[sh]; return sh === 0 ? P.metal1 : sh === 1 ? P.metal1 : P.metal2; }
          if (sleeve) return y <= 17 + dy ? (sh === 2 ? P.metal2 : P.metal1) : A[sh];
          if (l === L.HAND || l === L.FARHAND) return ramp('leather')[sh];
          if (legUpper) return A[sh];
          if (leg) return B[sh];
          if (foot) return boot[sh];
          return 0;
        }
        case 'jacket':
          if (l === L.TORSO) { if (front && Math.abs(x - mid) < 1) return shirt[1]; if (front && y <= 17 + dy && Math.abs(x - mid) < 2.5) return C[0]; return A[sh]; }
          if (sleeve) return A[sh];
          if (leg) return B[sh];
          if (foot) return boot[sh];
          return 0;
        case 'coat':
          if (l === L.TORSO) { if (front && Math.abs(x - mid) < 1) return (y - dy) % 2 ? C[0] : A[2]; return A[sh]; }
          if (sleeve) return A[sh];
          if (legUpper) return A[sh];
          if (l === L.SHIN && y <= 26) return A[sh];
          if (leg) return B[sh];
          if (foot) return boot[sh];
          return 0;
      }
      return 0;
    });
    /* garments that reach past the body */
    const add = [];
    const flare = (fromY, toY, color, opt = {}) => {
      for (let y = fromY; y <= toY; y++) {
        const k = Math.floor((y - fromY) / (opt.step || 2));
        let [x0, x1] = bodyBounds(fig, y);
        if (x1 < 0) [x0, x1] = [tx0, tx1];
        if (opt.legsOnly) { const legs = []; for (let x = 0; x < 16; x++) { const l = fig.get(x, y); if (l === L.THIGH || l === L.SHIN || l === L.FARLEG || l === L.FOOT || l === L.FARFOOT) legs.push(x); } if (legs.length) { x0 = Math.min(...legs); x1 = Math.max(...legs); } }
        const a = Math.min(x0, tx0) - k - (opt.pad || 0), b = Math.max(x1, tx1) + k + (opt.pad || 0);
        for (let x = a; x <= b; x++) {
          const lab = fig.get(x, y);
          if (opt.keepArms && (lab === L.ARM || lab === L.HAND)) continue;
          const rel = (x - a) / Math.max(1, b - a);
          const c = y === toY && opt.hem ? opt.hem[rel < 0.3 ? 0 : rel > 0.7 ? 2 : 1] : color[rel < 0.28 ? 0 : rel > 0.72 ? 2 : 1];
          add.push([x, y, c]);
        }
      }
    };
    if (style === 'dress') flare(waist + 1, 27, A, { legsOnly: true, keepArms: true, hem: C });
    if (style === 'robe') flare(waist, 29, A, { legsOnly: true, step: 3, keepArms: true, hem: B });
    if (style === 'coat') flare(waist + 1, 26, A, { legsOnly: true, step: 4, keepArms: true });
    if (style === 'apron' && front) for (let y = waist + 1; y <= 26; y++) for (let x = tx0 + 1; x <= tx1 - 1; x++) add.push([x, y, C[y === 26 ? 1 : 0]]);
    if (style === 'cloak') {
      if (back) flare(16 + dy, 27, B, { step: 4, pad: 0 });
      else if (side) for (let y = 16 + dy; y <= 27; y++) { const [, x1] = bodyBounds(fig, Math.min(y, 22 + dy)); for (let x = Math.max(8, x1 - 2); x <= Math.min(14, x1 + Math.floor((y - 16) / 4)); x++) add.push([x, y, B[x > x1 ? 2 : 1]]); }
      else for (let y = 16 + dy; y <= 26; y++) { for (const x of [tx0 - 1 - Math.floor((y - 16 - dy) / 5), tx1 + 1 + Math.floor((y - 16 - dy) / 5)]) { const lab = fig.get(x, y); if (lab === L.HAND) continue; add.push([x, y, B[x < mid ? 0 : 2]]); } }
      if (back) for (let x = 5; x <= 10; x++) add.push([x, 15 + dy, B[1]]), add.push([x, 16 + dy, B[2]]);
    }
    if (style === 'guard' && (front || back)) { add.push([tx0 - 1, 16 + dy, P.metal1], [tx1 + 1, 16 + dy, P.metal2]); }
    if (add.length) r = extend(r, fig, add);
    return r;
  });
}

/* ---------- hair ---------- */
const HAIRSTYLES = {
  crop: { name: 'Crop', v: 0.4, fringe: 'ragged', side: 11, back: 15 },
  swept: { name: 'Swept', v: 0.9, fringe: 'swept', side: 12, back: 15 },
  bob: { name: 'Bob', v: 1.1, fringe: 'straight', side: 15, back: 16 },
  long: { name: 'Long', v: 1, fringe: 'parted', side: 19, back: 21 },
  ponytail: { name: 'Ponytail', v: 0.7, fringe: 'back', side: 11, back: 14, tail: true },
  bun: { name: 'Top bun', v: 0.7, fringe: 'back', side: 11, back: 14, bun: true },
  curls: { name: 'Curls', v: 1.7, fringe: 'curly', side: 14, back: 16, curly: true },
  braids: { name: 'Braids', v: 0.7, fringe: 'parted', side: 12, back: 14, braids: true }
};
function hairLayer(styleKey, colorKey) {
  const st = HAIRSTYLES[styleKey];
  const c = ramp(colorKey);
  return FG.layerFrames('slim', (dir, fig, anim, f) => {
    const dy = fig.dy;
    const sway = anim === 'walk' ? [0, 1, 0, -1][f] : 0;
    const mask = new Uint8Array(16 * 32);
    const put = (x, y, v = 2) => { if (x >= 0 && x < 16 && y >= 0 && y < 32) mask[y * 16 + x] = v; };
    const side = dir === 'left';
    const cx = side ? 8.2 : 7.5, cy = 10.6 + dy, rx = (side ? 4.9 : 5.1) + st.v, ry = 4.6 + st.v * 0.9;
    const bump = (x, y) => st.curly ? (((x >> 1) + (y >> 1)) % 2 ? 0.45 : -0.2) : 0;
    const inCap = (x, y) => { const dx = (x + 0.5 - cx) / rx, dyy = (y + 0.5 - cy) / ry; return dx * dx + dyy * dyy <= 1 + bump(x, y) * 0.3; };
    for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
      if (!inCap(x, y)) continue;
      const ry0 = y - dy;
      if (dir === 'up') { if (ry0 <= st.back) put(x, y); continue; }
      if (dir === 'down') {
        const outer = x <= 3 || x >= 12;
        if (outer) { if (ry0 <= st.side) put(x, y); continue; }
        let line;
        switch (st.fringe) {
          case 'ragged': line = 9 + ((x * 7) % 3 === 0 ? 1 : 0); break;
          case 'swept': line = Math.round(11 - (x - 3) * 0.4); break;
          case 'straight': line = 10; break;
          case 'parted': line = (x === 7 || x === 8) ? 8 : 9 + (x < 7 ? (x > 4 ? 1 : 0) : (x < 11 ? 1 : 0)); break;
          case 'back': line = 8; break;
          case 'curly': line = 9 + (x % 2); break;
        }
        if (ry0 <= line) put(x, y);
      } else {
        const front = st.fringe === 'back' ? 8 : st.fringe === 'swept' ? 10 : 9;
        if (ry0 <= front && x >= 4) put(x, y);
        else if (x >= 8 && ry0 <= (x >= 10 ? st.side + 1 : 12)) put(x, y);
      }
    }
    /* lengths beyond the head */
    if (dir === 'down' && st.side > 15) for (let y = 16 + dy; y <= st.side + dy; y++) for (const x of [2, 3, 12, 13]) if (!(fig.get(x, y) === L.HAND)) put(x, y);
    if (dir === 'up' && st.back > 15) for (let y = 15 + dy; y <= st.back + dy; y++) for (let x = 3; x <= 12; x++) put(x, y);
    if (side && st.side > 15) for (let y = 15 + dy; y <= st.side + dy; y++) for (let x = 9; x <= 12; x++) put(x, y);
    if (st.tail) {
      if (dir === 'up') for (let y = 9 + dy; y <= 20 + dy; y++) for (let x = 7; x <= 8 + (y < 13 + dy ? 1 : 0); x++) put(x + (y > 15 + dy ? sway : 0), y);
      if (side) for (let k = 0; k < 10; k++) { const x = 12 + Math.min(2, k >> 1), y = 9 + dy + k; put(x + (k > 5 ? sway : 0), y); put(x + 1 + (k > 5 ? sway : 0), y, 3); }
      if (dir === 'down') { put(12, 9 + dy, 3); put(13, 10 + dy, 3); }
    }
    if (st.bun) {
      const by = 5 + dy, bx = side ? 9 : 7.5;
      for (let y = by - 2; y <= by + 2; y++) for (let x = Math.floor(bx - 2.5); x <= bx + 2.5; x++) if (Math.hypot(x + 0.5 - bx - 0.5 * (side ? 0 : 0), y + 0.5 - by) <= 2.4) put(x, y, y < by ? 1 : 2);
    }
    if (st.braids) {
      const drop = (x0, y0, len) => { for (let k = 0; k < len; k++) { const s = (k > len / 2 ? sway : 0); put(x0 + s, y0 + k, k % 2 ? 3 : 2); put(x0 + 1 + s, y0 + k, k % 2 ? 2 : 3); } put(x0 + (sway), y0 + len, 1); };
      if (dir === 'down') { drop(2, 12 + dy, 5); drop(12, 12 + dy, 5); }
      if (dir === 'up') { drop(4, 14 + dy, 8); drop(10, 14 + dy, 8); }
      if (side) drop(10, 13 + dy, 9);
    }
    /* shading: highlight band near the crown on the lit side, darker toward the bottom right */
    let top = 99; for (let i = 0; i < mask.length; i++) if (mask[i]) { top = Math.min(top, i >> 4); }
    const r = new Raster(16, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
      const v = mask[y * 16 + x]; if (!v) continue;
      let s = v === 1 ? 0 : v === 3 ? 2 : 1;
      if (v === 2) {
        if (y - top <= 2 && x < cx && y - top >= 1) s = 0;
        if (x >= cx + 3.5 || !mask[(y + 1) * 16 + x]) s = 2;
        if (y - top > 3 && (x + y) % 4 === 0) s = Math.max(s, 1) === 1 && x > cx ? 2 : s;
        if (st.curly && (x * 3 + y * 2) % 7 === 0 && y - top < 6) s = 0;
      }
      r.set(x, y, c[s]);
    }
    /* outline only toward the outside of the figure */
    const src = r.clone();
    for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
      if (src.get(x, y)) continue;
      const lab = fig.get(x, y);
      if (lab && lab !== L.OUT) continue;
      if (src.get(x - 1, y) || src.get(x + 1, y) || src.get(x, y - 1) || src.get(x, y + 1)) r.set(x, y, P.out);
    }
    return r;
  });
}

/* ---------- accessories ---------- */
const ACCESSORIES = {
  sunhat: { name: 'Sun hat', colors: [['gold', 'red'], ['cream', 'blue']] },
  beanie: { name: 'Knit cap', colors: [['red', 'cream'], ['green', 'cream']] },
  circlet: { name: 'Circlet', colors: [['gold', 'hteal'], ['metal', 'purple']] },
  glasses: { name: 'Round glasses', colors: [['leather', 'blue'], ['gold', 'blue']] },
  scarf: { name: 'Scarf', colors: [['red', 'gold'], ['blue', 'cream']] },
  backpack: { name: 'Backpack', colors: [['leather', 'gold'], ['green', 'leather']] },
  satchel: { name: 'Satchel', colors: [['leather', 'gold'], ['purple', 'gold']] },
  flowers: { name: 'Flower crown', colors: [['red', 'gold'], ['purple', 'cream']] }
};
function accessoryLayer(build, kind, cols) {
  const [A, B] = cols.map(rampOrMetal);
  return FG.layerFrames(build, (dir, fig) => {
    const dy = fig.dy, r = new Raster(16, 32);
    const front = dir === 'down', side = dir === 'left', back = dir === 'up';
    const S = (x, y, c) => r.set(x, y, c);
    let tx0 = 99, tx1 = -1; for (let x = 0; x < 16; x++) if (fig.get(x, 19 + dy) === L.TORSO) { tx0 = Math.min(tx0, x); tx1 = Math.max(tx1, x); }
    switch (kind) {
      case 'sunhat':
        for (let x = 0; x <= 15; x++) { S(x, 7 + dy, x < 4 ? A[0] : x > 12 ? A[2] : A[1]); if (x > 0 && x < 15) S(x, 8 + dy, A[2]); }
        for (let y = 3; y <= 6; y++) for (let x = 4; x <= 11; x++) if (!(y === 3 && (x === 4 || x === 11))) S(x, y + dy, y === 6 ? B[1] : x < 7 ? A[0] : A[1]);
        if (side) { S(0, 7 + dy, 0); S(15, 8 + dy, A[2]); }
        break;
      case 'beanie':
        for (let y = 4; y <= 9; y++) { const w = y === 4 ? 2 : y === 5 ? 4 : 5.5; for (let x = Math.ceil((side ? 8 : 7.5) - w); x <= Math.floor((side ? 8 : 7.5) + w); x++) S(x, y + dy, y >= 8 ? B[x % 2 ? 1 : 0] : (x % 2 ? A[1] : A[0])); }
        S(side ? 8 : 7, 3 + dy, B[0]); S(side ? 9 : 8, 3 + dy, B[1]);
        break;
      case 'circlet':
        if (front) { for (let x = 3; x <= 12; x++) S(x, 9 + dy, A[x < 7 ? 0 : 1]); S(7, 9 + dy, B[0]); S(8, 9 + dy, B[1]); S(7, 8 + dy, A[0]); S(8, 8 + dy, A[1]); }
        else if (side) { for (let x = 3; x <= 12; x++) S(x, 9 + dy, A[1]); S(4, 9 + dy, B[0]); }
        else for (let x = 3; x <= 12; x++) S(x, 10 + dy, A[2]);
        break;
      case 'glasses':
        if (front) { for (const ex of [5, 10]) { S(ex - 1, 12 + dy, A[1]); S(ex + 1, 12 + dy, A[1]); S(ex, 11 + dy, A[1]); S(ex, 14 + dy, A[1]); S(ex - 1, 13 + dy, A[1]); S(ex + 1, 13 + dy, A[1]); } S(7, 12 + dy, A[1]); S(8, 12 + dy, A[1]); S(4, 11 + dy, B[0]); S(9, 11 + dy, B[0]); }
        else if (side) { S(4, 12 + dy, A[1]); S(4, 13 + dy, A[1]); S(5, 11 + dy, A[1]); S(5, 14 + dy, A[1]); S(6, 12 + dy, A[1]); S(6, 13 + dy, A[1]); for (let x = 7; x <= 9; x++) S(x, 12 + dy, A[2]); }
        else { S(2, 12 + dy, A[2]); S(13, 12 + dy, A[2]); }
        break;
      case 'scarf':
        if (front || back) { for (let x = tx0 - 1; x <= tx1 + 1; x++) { S(x, 16 + dy, x % 2 ? A[0] : A[1]); S(x, 17 + dy, A[2]); } if (front) for (let y = 18; y <= 21; y++) { S(tx1 - 2, y + dy, y % 2 ? B[0] : A[1]); S(tx1 - 1, y + dy, A[2]); } }
        else { for (let x = 5; x <= 11; x++) { S(x, 16 + dy, A[x < 8 ? 0 : 1]); S(x, 17 + dy, A[2]); } for (let y = 18; y <= 22; y++) S(11 + (y > 20 ? 1 : 0), y + dy, y % 2 ? B[0] : A[1]); }
        break;
      case 'backpack':
        if (back) { for (let y = 16; y <= 23; y++) for (let x = tx0; x <= tx1; x++) S(x, y + dy, y === 16 || y === 17 ? B[1] : x === tx0 ? A[0] : x === tx1 ? A[2] : A[1]); S(Math.round((tx0 + tx1) / 2), 18 + dy, B[0]); }
        else if (front) { for (let y = 16; y <= 20; y++) { S(tx0 + 1, y + dy, A[2]); S(tx1 - 1, y + dy, A[2]); } }
        else { for (let y = 16; y <= 23; y++) for (let x = 10; x <= 13; x++) S(x, y + dy, x === 13 ? A[2] : y === 16 ? B[1] : A[1]); S(9, 17 + dy, A[2]); S(9, 18 + dy, A[2]); }
        break;
      case 'satchel':
        if (front) { for (let k = 0; k <= tx1 - tx0; k++) S(tx0 + k, 16 + dy + Math.round(k * 5 / Math.max(1, tx1 - tx0)), A[2]); for (let y = 21; y <= 24; y++) for (let x = tx1; x <= tx1 + 2; x++) S(x, y + dy, y === 21 ? B[0] : A[x === tx1 ? 0 : 1]); }
        else if (side) { for (let y = 16; y <= 21; y++) S(8 - Math.floor((y - 16) / 3), y + dy, A[2]); for (let y = 21; y <= 24; y++) for (let x = 5; x <= 8; x++) S(x, y + dy, y === 21 ? B[0] : A[1]); }
        else { for (let k = 0; k <= tx1 - tx0; k++) S(tx1 - k, 16 + dy + Math.round(k * 5 / Math.max(1, tx1 - tx0)), A[2]); }
        break;
      case 'flowers': {
        const xs = front || back ? [3, 5, 7, 9, 11, 12] : [4, 6, 8, 10, 12];
        xs.forEach((x, i) => { const y = (front || back) ? (i === 0 || i === xs.length - 1 ? 9 : 7) : 8; S(x, y + dy, i % 2 ? A[0] : B[0]); S(x + 1, y + dy, ramp('green')[1]); });
        break;
      }
    }
    if (r.count()) {
      const src = r.clone();
      for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
        if (src.get(x, y)) continue;
        const lab = fig.get(x, y);
        if (lab && lab !== L.OUT) continue;
        if (src.get(x - 1, y) || src.get(x + 1, y) || src.get(x, y - 1) || src.get(x, y + 1)) r.set(x, y, P.out);
      }
    }
    return r;
  });
}

/* ---------- pack assembly ---------- */
function build() {
  const pack = new Pack({ id: 'character-kit', name: 'Modular Character Kit', code: 'CK', palette: P });
  const sheets = { body: 'Bodies', outfit: 'Outfits', hair: 'Hair', accessory: 'Accessories' };
  for (const [id, name] of Object.entries(sheets)) pack.sheet(id, { name: `Character ${name.toLowerCase()}`, cellW: 16, cellH: 32, cols: 24, tileset: false });
  const layers = [];
  const counters = { body: 0, outfit: 0, hair: 0, accessory: 0 };
  const addLayer = (cat, id, name, frames, extra) => {
    const k = counters[cat]++;
    const col0 = (k % 4) * 6, row0 = Math.floor(k / 4) * 4;
    FG.DIRS.forEach((dir, d) => {
      for (const [anim, col] of [['walk', 0], ['idle', 4]]) {
        pack.add(cat, { id: `${id}-${anim}-${dir}`, name: `${name} — ${anim} ${dir}`, category: sheets[cat], frames: frames[dir][anim], durations: FG.ANIMS[anim].durations, at: [col0 + col, row0 + d], anchor: cat === 'body' ? 'feet' : undefined, allowHold: cat !== 'body', tags: [cat, anim, dir] });
      }
    });
    layers.push(Object.assign({ id, name, category: cat, sheet: cat, x: col0 * 16, y: row0 * 32 }, extra));
  };
  for (const [b, bn] of BUILDS) for (const [sk, sn] of SKINS) addLayer('body', `ck-body-${b}-${sk}`, `${bn} body, ${sn}`, bodyLayer(b, sk), { build: b, option: sk, optionName: sn, group: `body-${b}`, groupName: `${bn} body`, swatch: RAMPS[sk][1] });
  for (const [b, bn] of BUILDS) for (const [st, def] of Object.entries(OUTFITS)) def.colorways.forEach((cw, i) => addLayer('outfit', `ck-outfit-${st}-${i + 1}-${b}`, `${def.name} ${i + 1} (${bn.toLowerCase()})`, outfitLayer(b, st, cw), { build: b, group: st, groupName: def.name, option: String(i + 1), optionName: `Colourway ${i + 1}`, swatch: RAMPS[cw[0]] ? RAMPS[cw[0]][1] : '#dde1e9' }));
  for (const [st, def] of Object.entries(HAIRSTYLES)) for (const [hc, hn] of HAIRCOLORS) addLayer('hair', `ck-hair-${st}-${hc.slice(1)}`, `${def.name} hair, ${hn}`, hairLayer(st, hc), { group: st, groupName: def.name, option: hc, optionName: hn, swatch: RAMPS[hc][1] });
  for (const [b, bn] of BUILDS) for (const [kind, def] of Object.entries(ACCESSORIES)) def.colors.forEach((cols, i) => addLayer('accessory', `ck-acc-${kind}-${i + 1}-${b}`, `${def.name} ${i + 1} (${bn.toLowerCase()})`, accessoryLayer(b, kind, cols), { build: b, group: kind, groupName: def.name, option: String(i + 1), optionName: `Colour ${i + 1}`, swatch: cols[0] === 'metal' ? '#dde1e9' : RAMPS[cols[0]][1] }));
  pack.characters = {
    frameWidth: 16, frameHeight: 32, directions: FG.DIRS,
    animations: { walk: { column: 0, frames: 4, durations: FG.ANIMS.walk.durations }, idle: { column: 4, frames: 2, durations: FG.ANIMS.idle.durations } },
    layerSize: { columns: 6, rows: 4 }, order: ['body', 'outfit', 'hair', 'accessory'],
    builds: BUILDS.map(([id, name]) => ({ id, name })), layers
  };
  pack.layerSheets = layers;
  return pack;
}

module.exports = { build, palette: P, RAMPS, bodyLayer, outfitLayer, hairLayer, accessoryLayer, OUTFITS, HAIRSTYLES, ACCESSORIES };
