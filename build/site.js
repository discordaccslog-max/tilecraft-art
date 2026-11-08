'use strict';
/* Generates every HTML page of the storefront. */
const fs = require('fs');
const path = require('path');
const C = require('./content.js');

const SITE = 'https://discordaccslog-max.github.io/tilecraft-art/';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = n => n.toLocaleString('en-US');
const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';

const COPY = {
  'interface-essentials': { short: 'Nine-slice panels, windows, buttons in every state, slots, bars, dialogue boxes, cursors and icons in three themes.', tagline: 'A complete interface kit that stretches to any size.',
    body: ['Interface Essentials gives your game a full set of interface pieces in three matching themes — Dusk (indigo with brass trim), Vellum (parchment and ink) and Moss (green stone with copper). Panels, windows, frames, dialogue boxes, slots, bars, tabs and buttons are built as nine-slice pieces, and the JSON lists the slice margins for each one, so they stretch cleanly to any size.', 'Buttons come in normal, hover, pressed and disabled states; inventory slots in normal, hover, selected and disabled. There are health, energy and experience bar fills (smooth and segmented), toggles, checkboxes, radio buttons, slider and scrollbar parts, speech tails, a continue arrow, 12 cursors with hotspots and 19 icons.'] },
  meadowlands: { short: 'Grass, dirt, paths and animated water with full autotiling, plus flowers, rocks, fences, bushes and trees.', tagline: 'A sunny meadow tileset with water that moves and grass that sways.',
    body: ['Meadowlands is an outdoor tileset for farms, fields and forest edges. Dirt, path and water each come as a complete 47-tile autotiling set, so every shoreline, corner and narrow channel has its own tile. Water is animated, with moving ripples and foam along the bank, and the terrain sets sit on transparent surroundings so you can layer them over any ground.', 'Around them: eight grass ground tiles, swaying tall grass and reeds, six flower patches, rocks and a boulder, four bushes, five trees including a pine and a blossom tree, a stump and a log, a 16-piece connecting fence with gates, wooden bridge pieces, lily pads, stepping stones and two fluttering butterflies.'] },
  'effects-particles': { short: 'Animated sparkles, dust, smoke, magic swirls, pickups, splashes, impact flashes and level-up bursts.', tagline: 'Animated effects that loop cleanly and fade out cleanly.',
    body: ['Effects & Particles is a set of animated sprite sheets for game feel: sparkles in four colours, dust puffs, smoke puffs and a looping smoke plume, magic swirls, item pickup flashes, water and goo splashes, impact flashes and level-up bursts.', 'Looping effects loop without a jump, and one-shot effects fade to almost nothing on their last frame so they can be replayed back to back. There are also particle sprites — dots in three sizes and four colours, streaks, glints, rings, a snowflake, a tumbling leaf, an ember and a bubble — for your engine\'s particle system.'] },
  stonehollow: { short: 'Autotiling walls and floors, doors, stairs, pillars, opening chests, animated torches, plates and spike traps.', tagline: 'A dungeon tileset with walls that build themselves.',
    body: ['Stonehollow is a dungeon tileset built around two autotiling systems: walls that automatically show brick faces where they meet the floor and dark caps elsewhere, and raised floors that drop away into pits with a cliff face on the open side. A third set paints a bordered rug.', 'The props include wooden doors that open, an iron gate that rises, archways, stairs up and down, three pillars, wooden and gilded chests with opening animations, wall torches, a brazier, candles and a glowing crystal (all animated), pressure plates and rune plates in both states, a lever, an animated spike trap, banners, chains, cobwebs, urns, rubble, a grate, a puddle, a bookshelf and an altar.'] },
  hearthvale: { short: 'Modular houses, market stalls, wells, lampposts, crates, barrels, signposts and cobblestone autotiling.', tagline: 'A town tileset for building houses piece by piece.',
    body: ['Hearthvale is a town tileset with modular buildings. Walls come in plaster with timber framing, cut stone and wooden planks; roofs in clay tiles, slate and thatch. Each is a set of left, middle and right pieces, so houses can be any width. Doors, windows (including lit ones for evening scenes) and chimneys are separate overlays you place on top.', 'Around the houses: cobblestone paths and plaza slabs with full 47-tile autotiling, three market stalls, a well, an animated lamppost, a notice board and signposts with blank boards, a hay cart, crates, barrels, sacks, hay bales, benches, planters, trees, shrubs and a connecting picket fence.'] },
  'character-kit': { short: 'Layered bodies, skin tones, hair, outfits and accessories, each with four-direction walk and idle animations.', tagline: 'Build your own original characters from layers.',
    body: ['The Modular Character Kit is a layered character system. Pick a body (slim or sturdy) in one of six skin tones, add one of ten outfits in three colourways, one of eight hairstyles in six colours, and accessories such as hats, glasses, a scarf or a backpack. Every layer lines up frame for frame.', 'Each layer has a four-frame walk and a two-frame idle in four directions (down, left, right, up) on 16×32 frames. The studio\'s character builder lets you combine layers and export a finished sprite sheet, and the zip includes a ready-to-use sheet for every single layer.'] },
  'essentials-bundle': { short: 'All six Essentials packs together, unlocked by a single key.', tagline: 'Every Essentials pack in one purchase.',
    body: ['The Essentials Bundle includes all six Essentials packs — Interface Essentials, Meadowlands, Effects & Particles, Stonehollow, Hearthvale and the Modular Character Kit. One license key unlocks all six in your studio library, and each pack downloads as its own .zip with the same files as when bought separately.'] },
  'ink-edition': { short: 'A complete two-colour game kit: terrain, dungeon, town, characters, items, interface and effects.', tagline: 'A whole game world in two colours, designed together.',
    body: ['Ink Edition is a complete, standalone game kit drawn in a strict two-colour style: paper and ink. Every part was designed together — outdoor terrain with autotiling paths and animated water, an autotiling dungeon with props, a town with modular houses, 22 items, a full interface set and effects.', 'It includes its own layered character system with bodies in three tones, outfits, hair and accessories, all with four-direction walk and idle animations, and it works in the studio\'s character builder. Because every pixel is one of two colours, you can recolour the whole kit by swapping those two colours — the studio has a live recolour control.'] },
  'four-seasons': { short: 'Six biomes with full 47-tile autotiling in spring, summer, autumn and winter palettes.', tagline: 'Six biomes, four seasons, one consistent style.',
    body: ['Four Seasons is a terrain studio: meadow, forest, desert, snowfield, swamp and coast, each with ground tiles, a land autotiling set (dirt, underbrush, mesa cliffs, tundra grass, mud or dune grass) and an animated water autotiling set, all using the full 47-tile layout.', 'Everything comes in spring, summer, autumn and winter palettes drawn from one shared master palette, so trees turn gold in autumn and snow settles in winter while every tile still joins its neighbours. Each biome also has decor and animated foliage, and every biome comes with a finished sample map in each season.'] },
  'grand-atlas': { short: 'World-map scale terrain with autotiling, plus a seeded overworld generator in the studio.', tagline: 'Draw whole worlds — or let the generator draw one for you.',
    body: ['Grand Atlas is an overworld set at world-map scale, where each tile is a whole region: oceans with animated swell, shallows, coastlines with animated surf, plains, forests, hills, mountain ranges, deserts and snowfields, all with 47-tile autotiling. Rivers and roads connect automatically, and bridges carry roads across rivers.', 'Towns and landmarks are marked with small icons — villages, towns, walled cities, keeps, harbours, towers, ruins, shrines, caves, mines, lighthouses, windmills, camps and monuments — along with ships, whirlpools, waves, reefs, a compass rose and a parchment border. In the studio, the overworld generator builds new worlds from a seed, with sliders for land, mountains, forests, rivers and towns, and exports them as PNG images and Tiled maps.'] }
};

/* Inline script that writes markup during parsing; "</" is escaped so the string can't close the tag. */
const writeHTML = (prefixJS, html) => `<script>document.write(${prefixJS}${JSON.stringify(html).replace(/<\//g, '<\\/')});</script>`;
function page(o) {
  const r = o.absRoot || '../'.repeat(o.depth || 0);
  const url = SITE + (o.path || '');
  const headAssets = `<link rel="icon" href="${r}favicon.svg" type="image/svg+xml">
<link rel="preload" href="${r}fonts/schibsted-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${r}css/site.css">
${o.head || ''}<script>(function(){var t;try{t=localStorage.getItem('tilecraft.theme')}catch(e){}if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)})();</script>
`;
  const scripts = ['js/site-config.js', 'js/products.js', 'js/site.js'].concat(o.scripts || []);
  /* dynamicBase: the page can be served from any path (the 404 page), so its <base> and every asset
   * are written by one inline script; the browser then never requests them from the wrong folder. */
  const baseJS = `'<base href="' + (location.pathname.indexOf('/tilecraft-art/') === 0 ? '/tilecraft-art/' : '/') + '">' + `;
  const head = o.dynamicBase ? writeHTML(baseJS, headAssets) + '\n' : headAssets + scripts.map(s => `<script src="${r}${s}" defer></script>`).join('\n') + '\n';
  const tail = o.dynamicBase ? writeHTML('', scripts.map(s => `<script src="${s}"></script>`).join('')) + '\n' : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
${o.noindex ? '<meta name="robots" content="noindex, nofollow">\n' : `<link rel="canonical" href="${url}">\n`}<meta property="og:type" content="website">
<meta property="og:site_name" content="Tilecraft Art">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#14122b">
${head}</head>
<body class="${o.bodyClass || ''}" data-root="${r}">
<a class="skip-link" href="#main">Skip to content</a>
${header(r)}
<main id="main" tabindex="-1">
${o.body}
</main>
${footer(r)}
${tail}</body>
</html>
`;
}
function header(r) {
  return `<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="${r}" aria-label="Tilecraft Art home">${logoSvg()}<span>Tilecraft Art</span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span class="sr-only">Menu</span><svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="2" fill="none"/></svg></button>
    <nav id="site-nav" class="site-nav" aria-label="Main">
      <ul>
        <li><a href="${r}#packs">Packs</a></li>
        <li><a href="${r}#studio-editions">Studio Editions</a></li>
        <li><a href="${r}#free-sampler">Free sampler</a></li>
        <li><a href="${r}license/">License</a></li>
        <li><a href="${r}faq/">FAQ</a></li>
      </ul>
      <a class="key-link" href="${r}unlock/">Have a key?</a>
      <button class="theme-toggle" type="button" aria-label="Switch to light theme"><svg class="i-sun" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7 0h2v3H7zM7 13h2v3H7zM0 7h3v2H0zM13 7h3v2h-3zM5 5h6v6H5zM2 2h2v2H2zM12 2h2v2h-2zM2 12h2v2H2zM12 12h2v2h-2z"/></svg><svg class="i-moon" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6 1h4v1h2v1h1v2h-3V4H8v1H7v6h1v1h4v-1h2v2h-1v1h-2v1H6v-1H4v-1H3v-2H2V5h1V3h1V2h2z"/></svg></button>
    </nav>
  </div>
</header>`;
}
function footer(r) {
  const links = [['license/', 'License'], ['terms/', 'Terms'], ['privacy/', 'Privacy'], ['refunds/', 'Refunds'], ['delivery/', 'Delivery'], ['disclaimer/', 'Disclaimer'], ['contact/', 'Contact'], ['accessibility/', 'Accessibility'], ['about/', 'About'], ['faq/', 'FAQ']];
  return `<footer class="site-footer">
  <div class="wrap footer-inner">
    <div class="footer-brand">
      <p class="brand">${logoSvg()}<span>Tilecraft Art</span></p>
      <p class="muted">Original pixel art packs and the studio to try them in.</p>
      <p class="footer-email" data-support-email hidden></p>
      <p class="muted small">© <span data-year>2026</span> Tilecraft Art. Prices in USD.</p>
    </div>
    <nav aria-label="Policies and help"><ul class="footer-links">${links.map(([h, t]) => `<li><a href="${r}${h}">${t}</a></li>`).join('')}</ul></nav>
  </div>
</footer>`;
}
function logoSvg() {
  return `<svg class="logo" viewBox="0 0 12 12" width="24" height="24" aria-hidden="true" shape-rendering="crispEdges"><path fill="var(--accent)" d="M4 1h4v1h2v2h1v4h-1v2H8v1H4v-1H2V8H1V4h1V2h2z"/><path fill="var(--accent-deep)" d="M6 6h4v2H8v1H6zM2 6h2v2H2z"/><path fill="#fff7e6" d="M4 3h2v1H5v1H4z"/></svg>`;
}

function proseSections(doc, r, opts = {}) {
  const link = s => s.replace(/\{(\w+)\}/g, (_, k) => {
    const map = { contact: ['contact/', 'Contact page'], license: ['license/', 'License page'], unlock: ['unlock/', 'unlock page'], refunds: ['refunds/', 'Refund Policy'], delivery: ['delivery/', 'Delivery Policy'], disclaimer: ['disclaimer/', 'Disclaimer'] };
    const [h, t] = map[k]; return `<a href="${r}${h}">${t}</a>`;
  });
  return doc.sections.map(s => `<section class="prose-section"${opts.ids ? ` id="${s.h.toLowerCase().replace(/[^a-z]+/g, '-')}"` : ''}>
  <h2>${esc(s.h)}</h2>
  ${(s.p || []).map(p => `<p>${link(esc(p).replace(/\{(\w+)\}/g, '{$1}'))}</p>`).join('\n  ')}
  ${s.list ? `<ul>${s.list.map(li => `<li>${link(esc(li))}</li>`).join('')}</ul>` : ''}
</section>`).join('\n');
}
const linkify = (s, r) => s.replace(/\{(\w+)\}/g, (_, k) => {
  const map = { contact: ['contact/', 'Contact page'], license: ['license/', 'License page'], unlock: ['unlock/', 'unlock page'], refunds: ['refunds/', 'Refund Policy'], delivery: ['delivery/', 'Delivery Policy'], disclaimer: ['disclaimer/', 'Disclaimer'] };
  const [h, t] = map[k]; return `<a href="${r}${h}">${t}</a>`;
});
function disclosureBlock(r, headingLevel = 2) {
  return `<section class="disclosure" aria-labelledby="made-heading">
  <h${headingLevel} id="made-heading">How these assets are made</h${headingLevel}>
  ${C.DISCLOSURE.map(p => `<p>${esc(p)}</p>`).join('\n  ')}
  <p class="small"><a href="${r}faq/#ai">More in the FAQ</a></p>
</section>`;
}
function licenseTable(r) {
  return `<div class="license-table">
  <div><h3>You can</h3><ul class="yes">${C.LICENSE_SUMMARY.allowed.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>
  <div><h3>You can't</h3><ul class="no">${C.LICENSE_SUMMARY.notAllowed.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>
</div>
<p><a href="${r}license/">Read the full license</a></p>`;
}

function productCard(p, st, r, big) {
  return `<article class="product-card${big ? ' product-card--studio' : ''}${p.id === 'essentials-bundle' ? ' product-card--bundle' : ''}">
  <a class="card-link" href="${r}products/${p.id}/">
    <div class="vignette" data-scene="${p.id}" role="img" aria-label="Animated preview of ${esc(p.name)}, rendered from the pack's files"></div>
    <div class="card-body">
      <p class="tier pixel">${p.tier}</p>
      <h3>${esc(p.name)}</h3>
      <p class="card-desc">${esc(COPY[p.id].short)}</p>
      <p class="card-meta"><span class="price pixel" data-price="${p.id}">$${p.price}</span><span class="muted small">${fmt(st.assets)} assets · ${fmt(st.frames)} frames</span></p>
    </div>
  </a>
</article>`;
}

function statsFor(p, packs) {
  const list = p.packs.map(id => packs[id]);
  const sum = { assets: 0, frames: 0, animated: 0, autotiles: 0, files: 0, zip: 0, variants: 1, palette: 0 };
  for (const pk of list) { const s = pk.stats(); sum.assets += s.assets * s.variants; sum.frames += s.frames * s.variants; sum.animated += s.animated; sum.autotiles += s.autotiles.length; sum.files += pk.exportInfo.fileCount; sum.zip += pk.exportInfo.zipSize; }
  return sum;
}

function contentsSection(p, packs, r) {
  const parts = p.packs.map(id => packs[id]);
  const html = parts.map(pk => {
    const st = pk.stats(), meta = pk.exportInfo.meta;
    const cats = Object.entries(st.categories);
    const animGroups = {};
    for (const a of st.animations) { const k = `${a.category}|${a.frames}|${a.durations.join(',')}|${a.loop}|${a.size}`; animGroups[k] = (animGroups[k] || 0) + 1; }
    const fmts = new Set(pk.exportInfo.files.map(f => f.split('.').pop().toUpperCase()));
    const fmtNames = { PNG: 'PNG images', JSON: 'JSON metadata', TSX: 'Tiled tilesets (.tsx)', TMX: 'Tiled maps (.tmx)', HEX: 'palette (.hex)', GPL: 'palette (.gpl)', TXT: 'LICENSE.txt and README.txt' };
    const tileSizes = Object.entries(st.sizes).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} px (${fmt(n)})`).join(', ');
    return `<section class="contents-block" aria-labelledby="c-${pk.id}">
  <h3 id="c-${pk.id}">${parts.length > 1 ? esc(pk.name) : 'Exact contents'}</h3>
  <dl class="facts">
    <div><dt>Assets</dt><dd>${fmt(st.assets)}${st.variants > 1 ? ` × ${st.variants} seasonal palettes = ${fmt(st.assets * st.variants)} asset files` : ''}</dd></div>
    <div><dt>Frames</dt><dd>${fmt(st.frames)}${st.variants > 1 ? ` per palette (${fmt(st.frames * st.variants)} in total)` : ''}</dd></div>
    <div><dt>Animated assets</dt><dd>${fmt(st.animated)}</dd></div>
    <div><dt>Tile grid</dt><dd>${meta.tileSize}×${meta.tileSize} px</dd></div>
    <div><dt>Asset sizes</dt><dd>${tileSizes}</dd></div>
    <div><dt>Autotile sets</dt><dd>${st.autotiles.length ? st.autotiles.map(t => `${esc(t.name)} (${t.tiles} tiles${t.frames > 1 ? `, ${t.frames} frames` : ''})`).join(', ') : 'None — this pack has no terrain'}</dd></div>
    <div><dt>Sprite sheets</dt><dd>${st.sheets.map(s => `${esc(s.name)} (${s.width}×${s.height})`).join(', ')}${st.variants > 1 ? `, each in ${st.variants} palettes` : ''}</dd></div>
    <div><dt>Palette</dt><dd>${st.palette} colours${st.variants > 1 ? ` in one master palette, mapped to ${st.variants} seasonal palettes` : ''}</dd></div>
    ${st.maps.length ? `<div><dt>Sample maps</dt><dd>${st.maps.length} (${[...new Set(st.maps.map(m => `${m.w}×${m.h} tiles`))].join(', ')})</dd></div>` : ''}
    <div><dt>File formats</dt><dd>${[...fmts].map(f => fmtNames[f] || f).join(', ')}</dd></div>
    <div><dt>Download</dt><dd>${fmt(pk.exportInfo.fileCount)} files in one .zip (${kb(pk.exportInfo.zipSize)})</dd></div>
  </dl>
  <details class="table-details"><summary>Breakdown by category (${cats.length} categories)</summary>
  <div class="table-scroll"><table><thead><tr><th scope="col">Category</th><th scope="col">Assets</th><th scope="col">Frames</th><th scope="col">Animated</th></tr></thead><tbody>
  ${cats.map(([c, v]) => `<tr><th scope="row">${esc(c)}</th><td>${fmt(v.assets)}</td><td>${fmt(v.frames)}</td><td>${fmt(v.animated)}</td></tr>`).join('\n  ')}
  </tbody></table></div></details>
  ${st.animations.length ? `<details class="table-details"><summary>Animations: frame counts and timings</summary>
  <div class="table-scroll"><table><thead><tr><th scope="col">Category</th><th scope="col">Size</th><th scope="col">Frames</th><th scope="col">Timing (ms per frame)</th><th scope="col">Playback</th><th scope="col">Count</th></tr></thead><tbody>
  ${Object.entries(animGroups).map(([k, n]) => { const [cat, fr, dur, loop, size] = k.split('|'); return `<tr><th scope="row">${esc(cat)}</th><td>${size}</td><td>${fr}</td><td>${[...new Set(dur.split(','))].length === 1 ? dur.split(',')[0] : dur.split(',').join(' / ')}</td><td>${loop === 'true' ? 'Loops' : 'Plays once'}</td><td>${fmt(n)}</td></tr>`; }).join('\n  ')}
  </tbody></table></div></details>` : ''}
</section>`;
  }).join('\n');
  return html;
}

const STUDIO_WHY = {
  'ink-edition': (packs) => { const s = packs['ink-edition'].stats(); return [`Ink Edition is a complete, matched kit rather than a single tileset: ${fmt(s.assets)} assets covering terrain, a dungeon, a town, ${Object.entries(s.categories).filter(([c]) => c === 'Items').map(([, v]) => v.assets)[0]} items, interface pieces, effects and a full layered character system.`, 'Everything shares one two-colour style, so pieces from different parts of the kit always sit together, and the whole kit recolours by swapping two colours — live in the studio.', `For comparison, each Essentials pack covers one area: Meadowlands has ${fmt(packs.meadowlands.stats().assets)} outdoor assets, Stonehollow ${fmt(packs.stonehollow.stats().assets)} dungeon assets.`]; },
  'four-seasons': (packs) => { const s = packs['four-seasons'].stats(); const m = packs.meadowlands.stats(); return [`Meadowlands has one biome, ${m.autotiles.length} autotile sets and one palette. Four Seasons has six biomes, ${s.autotiles.length} full 47-tile autotile sets and four seasonal palettes — ${fmt(s.assets)} assets drawn once and delivered as ${fmt(s.assets * s.variants)} asset files.`, 'Every season comes with its own Tiled tilesets and a finished sample map for every biome, and the studio switches seasons live in the preview and the map playground.']; },
  'grand-atlas': (packs) => { const s = packs['grand-atlas'].stats(); return [`Grand Atlas is the only pack with world-map scale terrain: ${s.autotiles.length} autotiling systems (${s.autotiles.map(t => t.name.toLowerCase()).join(', ')}) and ${fmt(s.assets)} assets designed for overworld maps.`, 'It also adds a tool to the studio: a seeded overworld generator that builds new worlds on demand with controls for land, mountains, forests, rivers and towns, and exports them as PNG images and Tiled maps. Same seed, same world — every time.']; }
};

function productPage(p, packs, products, r) {
  const st = statsFor(p, packs);
  const copy = COPY[p.id];
  const studio = p.tier === 'Studio Edition';
  const first = packs[p.packs[0]];
  const animIds = p.packs.flatMap(id => packs[id].assets.filter(a => a.frames.length > 1 && !(a.meta && a.meta.autotile) && !a.id.includes('-idle-') && !(a.id.includes('-walk-') && !a.id.includes('-walk-down'))).slice(0, 40).map(a => `${id}|${a.id}`));
  const pick = []; const step = Math.max(1, Math.floor(animIds.length / 12)); for (let i = 0; i < animIds.length && pick.length < 12; i += step) pick.push(animIds[i]);
  const maps = p.packs.flatMap(id => packs[id].maps.filter((m, i) => id !== 'four-seasons' || m.id.endsWith('-summer') || i < 4).slice(0, id === 'four-seasons' ? 6 : 3).map(m => ({ pack: id, id: m.id, name: m.name })));
  const unlocks = p.packs.map(id => packs[id].name);
  const body = `
<div class="wrap product-page${studio ? ' is-studio' : ''}">
  <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${r}">Home</a> <span aria-hidden="true">/</span> <a href="${r}#${studio ? 'studio-editions' : 'packs'}">${studio ? 'Studio Editions' : 'Essentials'}</a></nav>
  <div class="product-hero">
    <div class="product-intro">
      <p class="tier pixel">${p.tier}</p>
      <h1>${esc(p.name)}</h1>
      <p class="lede">${esc(copy.tagline)}</p>
      <div class="vignette vignette--large" data-scene="${p.id}" data-scale="max" role="img" aria-label="Animated preview of ${esc(p.name)}, rendered from the pack's files"></div>
      <p class="caption">Live preview rendered in your browser from the pack's own sprite sheets.</p>
    </div>
    <aside class="buy-panel" aria-label="Price and purchase">
      <p class="price-big pixel" data-price="${p.id}">$${p.price}</p>
      <p class="buy-terms">Instant access with a license key · <a href="${r}refunds/">14-day refund policy</a> · Applicable taxes are shown at checkout</p>
      <div class="buy-area" data-buy="${p.id}"></div>
      <ul class="buy-facts">
        <li><strong>${fmt(st.assets)}</strong> asset files, <strong>${fmt(st.frames)}</strong> frames</li>
        <li>${p.packs.length > 1 ? `Unlocks ${unlocks.length} packs: ${unlocks.map(esc).join(', ')}` : `16×16 grid · PNG at 1×, 2× and 4×`}</li>
        <li>${fmt(st.files)} files · ${kb(st.zip)} to download</li>
        <li>Opens in the Tilecraft Studio on any of your devices</li>
      </ul>
      <p class="small"><a href="${r}unlock/">Already bought it? Enter your key</a></p>
    </aside>
  </div>
  <div class="product-body">
    <section aria-labelledby="about-h"><h2 id="about-h">About this pack</h2>${copy.body.map(b => `<p>${esc(b)}</p>`).join('')}</section>
    ${studio ? `<section class="studio-why" aria-labelledby="why-h"><h2 id="why-h">Why it's a Studio Edition</h2>${STUDIO_WHY[p.id](packs).map(t => `<p>${esc(t)}</p>`).join('')}</section>` : ''}
    <section aria-labelledby="contents-h"><h2 id="contents-h">What's inside</h2>
      <p class="muted">Every number on this page is read from the generated files at build time.</p>
      ${contentsSection(p, packs, r)}
    </section>
    <section aria-labelledby="preview-h"><h2 id="preview-h">Previews</h2>
      <p class="muted">Animated previews and full sheets, drawn from the files you download. Sheets are shown at 2×; zoom further in the studio.</p>
      ${pick.length ? `<h3>Animations</h3><div class="anim-grid">${pick.map(k => { const [pid, aid] = k.split('|'); const a = packs[pid].asset(aid); return `<figure class="anim-cell"><div class="sprite" data-pack="${pid}" data-asset="${aid}" role="img" aria-label="${esc(a.name)}, ${a.frames.length} frames"></div><figcaption>${esc(a.name)} <span class="muted">· ${a.frames.length} frames</span></figcaption></figure>`; }).join('')}</div>` : ''}
      ${p.id === 'character-kit' || p.id === 'ink-edition' ? `<h3>Assembled characters</h3><div class="vignette vignette--chars" data-scene="${p.id === 'ink-edition' ? 'ink-edition' : 'character-kit'}" data-scale="max" role="img" aria-label="Characters assembled from layers"></div>` : ''}
      ${p.id === 'grand-atlas' ? `<h3>Try the generator</h3><div class="mini-gen" data-mini-gen><div class="mini-gen-canvas" role="img" aria-label="A small world generated from a seed"></div><div class="mini-gen-controls"><label for="mg-seed">Seed</label><input id="mg-seed" type="text" value="harbor lights" autocomplete="off" spellcheck="false"><button type="button" class="btn btn-ghost" data-mg-random>New seed</button></div><p class="small muted">A small version of the studio's generator, drawing with the pack's own tiles. The full generator in the studio adds size, land, mountains, forests, rivers and towns controls, plus PNG and Tiled export.</p></div>` : ''}
      <h3>Sheets</h3>
      ${p.packs.map(id => { const pk = packs[id]; return pk.sheets.map(s => `<figure class="sheet-figure"><div class="sheet-scroll" tabindex="0" role="region" aria-label="${esc(s.name)} sheet, scrollable"><div class="sheet-view" data-pack="${id}" data-sheet="${s.id}"></div></div><figcaption>${esc(s.name)} — ${s.cols * s.cellW}×${s.rows * s.cellH} px${pk.variants ? ' (summer palette shown)' : ''}</figcaption></figure>`).join(''); }).join('')}
      ${maps.length ? `<h3>Sample maps</h3><div class="map-grid">${maps.map(m => `<figure><div class="map-view" data-src="${r}assets/packs/${m.pack}/maps/${m.id}.png" role="img" aria-label="${esc(m.name)}"></div><figcaption>${esc(m.name)}</figcaption></figure>`).join('')}</div>` : ''}
    </section>
    ${disclosureBlock(r)}
    <section aria-labelledby="lic-h"><h2 id="lic-h">License in brief</h2>${licenseTable(r)}</section>
  </div>
</div>`;
  return page({ title: `${p.name} — ${p.tier === 'Studio Edition' ? 'Studio Edition' : 'pixel art pack'} | Tilecraft Art`, description: `${copy.short} ${fmt(st.assets)} assets, 16×16 grid, PNG/JSON/Tiled files. $${p.price}.`, path: `products/${p.id}/`, depth: 2, body, scripts: ['js/pixel.js', 'js/autotile.js'].concat(p.id === 'grand-atlas' ? ['studio/atlas-gen.js', 'js/minigen.js'] : []), bodyClass: 'page-product' });
}

function homePage(products, packs, r, sample) {
  const ess = products.filter(p => p.tier === 'Essentials'), stu = products.filter(p => p.tier !== 'Essentials');
  const body = `
<section class="hero" aria-labelledby="hero-h">
  <div class="wrap hero-copy">
    <p class="eyebrow pixel">16×16 pixel art packs</p>
    <h1 id="hero-h">Original pixel art for your game, with a studio to try it in.</h1>
    <p class="lede">Tilesets with full autotiling, effects, interface pieces and modular characters — each pack opens in the Tilecraft Studio, where you can preview every asset, paint test maps and download the files.</p>
    <div class="cta-row"><a class="btn btn-primary" href="#packs">Browse the packs</a><a class="btn btn-ghost" href="#free-sampler">Paint with the free sampler</a></div>
  </div>
  <div class="diorama" aria-label="Animated scene built from the packs: a town, a meadow with a pond, and a torch-lit ruin, with characters walking along the path" role="img">
    <div class="diorama-canvas" data-scene="hero" data-scale="hero"></div>
    <div class="dusk" aria-hidden="true"></div>
    <div class="glow-layer" aria-hidden="true"></div>
  </div>
  <p class="wrap caption">Every scene on this site is rendered live from the real sprite sheets. Scroll and the light turns to dusk.</p>
</section>

<section class="wrap painter-section" id="free-sampler" aria-labelledby="painter-h">
  <div class="painter-copy">
    <p class="eyebrow pixel">Free · same license</p>
    <h2 id="painter-h">Paint a little map</h2>
    <p>This painter uses the free Mossway Sampler: moss ground, stepping stones that connect automatically, and a few plants. Click or tap to paint, or use the arrow keys and Space. The sampler's tiles aren't part of any paid pack, and it uses the same license.</p>
    <p><a class="btn btn-primary" href="${r}assets/packs/sample/tilecraft-sample.zip" download>Download the free sampler (.zip, ${kb(sample.zipSize)})</a></p>
    <p class="small muted">${sample.meta.assets.length} tiles · PNG at 1×, 2×, 4× · JSON · Tiled .tsx/.tmx · palette · ${sample.fileCount} files</p>
  </div>
  <div class="painter" data-painter>
    <div class="painter-tools" role="toolbar" aria-label="Painter tools">
      <button type="button" class="tool is-active" data-tool="stones" aria-pressed="true">Stones</button>
      <button type="button" class="tool" data-tool="decor" aria-pressed="false">Plants</button>
      <button type="button" class="tool" data-tool="erase" aria-pressed="false">Erase</button>
      <button type="button" class="tool" data-tool="clear">Clear</button>
    </div>
    <div class="painter-canvas" tabindex="0" role="application" aria-label="Map painter. Arrow keys move the cursor, Space or Enter paints."></div>
  </div>
</section>

<section class="tier-section" id="packs" aria-labelledby="ess-h">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow pixel">Tier one</p><h2 id="ess-h">Essentials</h2><p class="muted">Focused packs, one area each. Buy one, or all six in the bundle.</p></div>
    <div class="card-grid">${ess.map(p => productCard(p, statsFor(p, packs), r)).join('\n')}</div>
  </div>
</section>

<section class="studio-showcase" id="studio-editions" aria-labelledby="stu-h">
  <div class="parallax" aria-hidden="true"><div class="px-layer" data-depth="0.15" data-scene-bg="grand-atlas"></div><div class="px-layer" data-depth="0.35" data-scene-bg="four-seasons"></div></div>
  <div class="wrap studio-inner">
    <div class="section-head"><p class="eyebrow pixel">Tier two</p><h2 id="stu-h">Studio Editions</h2><p>Bigger, complete systems: a whole matched world, six biomes in four seasons, or an overworld generator built into the studio.</p></div>
    <article class="featured">
      <a class="featured-link" href="${r}products/grand-atlas/">
        <div class="vignette vignette--featured" data-scene="grand-atlas" data-scale="max" role="img" aria-label="Animated preview of a generated Grand Atlas world"></div>
        <div class="featured-copy"><p class="tier pixel">Featured · Studio Edition</p><h3>Grand Atlas: Overworld Studio</h3><p>${esc(COPY['grand-atlas'].short)}</p><p class="card-meta"><span class="price pixel" data-price="grand-atlas">$75</span><span class="small">${fmt(packs['grand-atlas'].stats().assets)} assets · ${packs['grand-atlas'].autotiles.length} autotiling systems · seeded generator</span></p></div>
      </a>
    </article>
    <div class="card-grid card-grid--studio">${stu.filter(p => p.id !== 'grand-atlas').map(p => productCard(p, statsFor(p, packs), r, true)).join('\n')}</div>
  </div>
</section>

<section class="wrap steps" aria-labelledby="how-h">
  <h2 id="how-h">How buying and unlocking work</h2>
  <ol class="step-list">
    <li><span class="step-n pixel">1</span><h3>Buy a pack</h3><p>Pay through the secure checkout. Taxes, if any, are shown before you pay.</p></li>
    <li><span class="step-n pixel">2</span><h3>Get your key instantly</h3><p>Your license key appears on the confirmation page. Copy it and save it.</p></li>
    <li><span class="step-n pixel">3</span><h3>Unlock in the studio</h3><p>Enter the key on the <a href="${r}unlock/">unlock page</a>. Preview, paint, and download your files.</p></li>
  </ol>
</section>

<section class="wrap faq-preview" aria-labelledby="faqp-h">
  <h2 id="faqp-h">Questions</h2>
  ${C.FAQ.filter(f => f.preview).map(f => `<details><summary>${esc(f.q)}</summary>${f.a.map(a => `<p>${linkify(esc(a), r)}</p>`).join('')}</details>`).join('\n  ')}
  <p><a href="${r}faq/">All questions</a></p>
</section>
${'<div class="wrap">' + disclosureBlock(r) + '</div>'}`;
  return page({ title: 'Tilecraft Art — original 16×16 pixel art packs for games', description: 'Original pixel art tilesets, effects, interface kits and modular characters on a 16×16 grid, with full autotiling and an in-browser studio to preview, paint and download.', path: '', depth: 0, body, scripts: ['js/autotile.js', 'js/pixel.js', 'js/home.js'], bodyClass: 'page-home' });
}

function proseDoc(doc, slug, desc, extra = '') {
  const r = '../';
  const body = `<div class="wrap prose">
  <h1>${esc(doc.title)}</h1>
  <p class="updated muted">Last updated: ${C.UPDATED}</p>
  ${doc.intro ? `<p class="lede">${esc(doc.intro)}</p>` : ''}
  ${extra}
  ${proseSections(doc, r)}
</div>`;
  return page({ title: `${doc.title} | Tilecraft Art`, description: desc, path: `${slug}/`, depth: 1, body });
}

function thankYouPage(p, packs) {
  const r = '../../';
  const body = `<div class="wrap narrow thankyou" data-thankyou="${p.code}" data-product="${p.id}">
  <p class="eyebrow pixel">Order confirmed</p>
  <h1>Thank you — here's your license key</h1>
  <p class="lede">Your key for <strong>${esc(p.name)}</strong> is ready. It unlocks ${p.packs.length > 1 ? `all ${p.packs.length} Essentials packs` : 'your pack'} in the Tilecraft Studio.</p>
  <div class="key-reveal">
    <canvas class="chest" width="32" height="32" aria-hidden="true"></canvas>
    <p class="key-display pixel" aria-live="polite" aria-atomic="true"><span class="sr-only">Your license key: </span><span data-key></span></p>
  </div>
  <div class="key-actions">
    <button type="button" class="btn btn-primary" data-copy>Copy key</button>
    <a class="btn btn-ghost" href="${r}unlock/" data-open>Open my packs</a>
  </div>
  <p class="copy-status small" role="status" aria-live="polite"></p>
  <div class="notice"><h2>Save your key now</h2><p>Copy it into a password manager, a note or an email to yourself. You'll need it to open your packs on another device or browser. If you ever lose it, contact us through the <a href="${r}contact/">Contact page</a> with your order number.</p></div>
  <noscript><p class="notice">Your key is created in your browser, so this page needs JavaScript. Please turn JavaScript on and reload.</p></noscript>
</div>`;
  return page({ title: `Your license key — ${p.name} | Tilecraft Art`, description: `Order confirmation and license key for ${p.name}.`, path: `thank-you/${p.id}/`, depth: 2, body, noindex: true, scripts: ['js/license.js', 'js/thankyou.js'], bodyClass: 'page-thankyou' });
}

function keyEntry(idPrefix) {
  return `<form class="key-form" data-key-form novalidate>
  <fieldset>
    <legend>License key</legend>
    <div class="key-segments">
      <span class="key-prefix pixel" aria-hidden="true">TILE</span><span class="dash" aria-hidden="true">–</span>
      <input class="seg" id="${idPrefix}-1" data-len="2" maxlength="2" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Product code, 2 characters"><span class="dash" aria-hidden="true">–</span>
      <input class="seg" id="${idPrefix}-2" data-len="5" maxlength="5" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Key part 1, 5 characters"><span class="dash" aria-hidden="true">–</span>
      <input class="seg" id="${idPrefix}-3" data-len="5" maxlength="5" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Key part 2, 5 characters"><span class="dash" aria-hidden="true">–</span>
      <input class="seg" id="${idPrefix}-4" data-len="4" maxlength="4" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Check code, 4 characters">
    </div>
  </fieldset>
  <p class="key-error" role="alert" aria-live="assertive"></p>
  <button type="submit" class="btn btn-primary">Unlock</button>
  <p class="small muted">Tip: paste your whole key into the first box — it fills in the rest.</p>
</form>`;
}
function unlockPage() {
  const r = '../';
  const body = `<div class="wrap narrow unlock-page">
  <p class="eyebrow pixel">Have a key?</p>
  <h1>Unlock your packs</h1>
  <p class="lede">Enter the license key from your order confirmation page. Your packs open in your library inside the Tilecraft Studio, on this device.</p>
  <div class="unlock-card">${keyEntry('k')}
    <div class="unlock-success" hidden tabindex="-1"><canvas class="unlock-burst" width="64" height="64" aria-hidden="true"></canvas><h2>Unlocked</h2><p data-unlocked-list></p><a class="btn btn-primary" href="${r}studio/">Open my library</a></div>
  </div>
  <p class="small">Your key is saved only in this browser. Using another device? Enter the same key there. Lost your key? <a href="${r}contact/">Contact us</a> with your order number.</p>
  <p class="small"><a href="${r}studio/">Go to your library</a></p>
</div>`;
  return page({ title: 'Unlock your packs | Tilecraft Art', description: 'Enter your Tilecraft Art license key to open your packs in the Tilecraft Studio.', path: 'unlock/', depth: 1, body, scripts: ['js/license.js', 'js/keyentry.js', 'js/unlock.js'], bodyClass: 'page-unlock' });
}

function faqPage() {
  const r = '../';
  const body = `<div class="wrap prose">
  <h1>Frequently asked questions</h1>
  ${C.FAQ.map((f, i) => `<section class="faq-item" id="${f.q.includes('AI') ? 'ai' : 'q' + (i + 1)}"><h2>${esc(f.q)}</h2>${f.a.map(a => `<p>${linkify(esc(a), r)}</p>`).join('')}</section>`).join('\n  ')}
</div>`;
  return page({ title: 'FAQ — keys, downloads, license and more | Tilecraft Art', description: 'How license keys work, downloading packs, what is in each zip, engine compatibility, autotiling, commercial use, AI disclosure, refunds and more.', path: 'faq/', depth: 1, body });
}
function contactPage() {
  const r = '../';
  const body = `<div class="wrap prose">
  <h1>Contact</h1>
  <p class="lede">We answer every message within two business days.</p>
  <p class="contact-email" data-support-email-block hidden>Email us at <a data-support-email-link href="#"></a>.</p>
  <section class="prose-section"><h2>What to include</h2><ul><li>Your order number</li><li>The email address you used at checkout</li><li>What you need help with — for example a lost key, a refund, or a problem with a file (the asset name or ID helps)</li></ul></section>
  <section class="prose-section"><h2>Common requests</h2><ul><li><strong>Refunds:</strong> available within 14 days of purchase, no reason needed. See the <a href="${r}refunds/">Refund Policy</a>.</li><li><strong>Lost key:</strong> include your order number and we'll send a replacement.</li><li><strong>License questions:</strong> the <a href="${r}license/">License page</a> covers most cases; ask if you're unsure.</li><li><strong>Privacy requests:</strong> access, correction or deletion of your information — see the <a href="${r}privacy/">Privacy Policy</a>.</li></ul></section>
</div>`;
  return page({ title: 'Contact | Tilecraft Art', description: 'How to contact Tilecraft Art about orders, keys, refunds and files. Replies within two business days.', path: 'contact/', depth: 1, body });
}
function licensePage() {
  return proseDoc(C.LICENSE, 'license', 'The Tilecraft Art license in plain language: use the assets in unlimited games, including commercial ones, with no attribution required.', `<section class="prose-section"><h2>Summary</h2>${licenseTable('../')}</section>`);
}
function studioShell() {
  const r = '../';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Tilecraft Studio</title>
<meta name="description" content="Your Tilecraft Art library: preview every asset, play animations, paint maps, build characters, generate worlds and download your packs.">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#14122b">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="${r}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="preload" href="${r}fonts/schibsted-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${r}css/site.css">
<link rel="stylesheet" href="studio.css">
<script>(function(){var t,b;try{t=localStorage.getItem('tilecraft.theme');b=localStorage.getItem('tilecraft.large')}catch(e){}if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);if(b==='1')document.documentElement.classList.add('large-ui')})();</script>
<script src="${r}js/site-config.js" defer></script>
<script src="${r}js/products.js" defer></script>
<script src="${r}js/autotile.js" defer></script>
<script src="${r}js/license.js" defer></script>
<script src="${r}js/keyentry.js" defer></script>
<script src="atlas-gen.js" defer></script>
<script src="tiled.js" defer></script>
<script src="app.js" defer></script>
<script src="playground.js" defer></script>
<script src="characters.js" defer></script>
<script src="generator.js" defer></script>
</head>
<body class="studio-body" data-root="${r}">
<a class="skip-link" href="#studio-main">Skip to content</a>
<header class="studio-top">
  <a class="brand" href="${r}" aria-label="Tilecraft Art home">${logoSvg()}<span>Tilecraft Studio</span></a>
  <nav class="studio-crumbs" aria-label="Studio"><a href="#/library">Library</a><span data-crumb></span></nav>
  <div class="studio-actions">
    <button type="button" class="icon-btn" data-large aria-pressed="false" title="Larger interface"><span aria-hidden="true">A+</span><span class="sr-only">Larger interface</span></button>
    <button type="button" class="icon-btn theme-toggle" aria-label="Switch to light theme"><svg class="i-sun" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7 0h2v3H7zM7 13h2v3H7zM0 7h3v2H0zM13 7h3v2h-3zM5 5h6v6H5zM2 2h2v2H2zM12 2h2v2h-2zM2 12h2v2H2zM12 12h2v2h-2z"/></svg><svg class="i-moon" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6 1h4v1h2v1h1v2h-3V4H8v1H7v6h1v1h4v-1h2v2h-1v1h-2v1H6v-1H4v-1H3v-2H2V5h1V3h1V2h2z"/></svg></button>
  </div>
</header>
<main id="studio-main" class="studio-main" tabindex="-1"><p class="studio-loading">Loading your studio…</p></main>
<div class="toast" role="status" aria-live="polite"></div>
<noscript><p class="wrap">The Tilecraft Studio needs JavaScript to run.</p></noscript>
</body>
</html>
`;
}
function notFound() {
  /* Hosts serve this page at any depth, and the site may live at the domain root (Vercel) or
   * under /tilecraft-art/ (GitHub Pages); dynamicBase makes every relative link resolve from the
   * site root on either host. */
  const body = `<div class="wrap narrow notfound"><p class="eyebrow pixel">404</p><h1>This tile isn't on the map</h1><p class="lede">The page you're looking for doesn't exist or has moved.</p><div class="vignette" data-scene="sample" aria-hidden="true"></div><p><a class="btn btn-primary" href="./">Back to the home page</a> <a class="btn btn-ghost" href="unlock/">Enter a key</a></p></div>`;
  return page({ title: 'Page not found | Tilecraft Art', description: 'This page does not exist.', path: '404.html', depth: 0, dynamicBase: true, body, noindex: true, scripts: ['js/pixel.js'] });
}

function writeAll(root, ctx) {
  const { products, packs, sample } = ctx;
  const W = (rel, html) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };
  W('index.html', homePage(products, packs, '', sample));
  for (const p of products) { W(`products/${p.id}/index.html`, productPage(p, packs, products, '../../')); W(`thank-you/${p.id}/index.html`, thankYouPage(p, packs)); }
  W('unlock/index.html', unlockPage());
  W('studio/index.html', studioShell());
  W('license/index.html', licensePage());
  W('terms/index.html', proseDoc(C.TERMS, 'terms', 'Terms of Service for Tilecraft Art: digital game art packs and the Tilecraft Studio, unlocked with a license key.'));
  W('privacy/index.html', proseDoc(C.PRIVACY, 'privacy', 'No cookies, no analytics, no trackers. Keys and saved work stay in your browser. How Tilecraft Art handles order information.'));
  W('refunds/index.html', proseDoc(C.REFUNDS, 'refunds', 'Full refund on any Tilecraft Art purchase within 14 days, no reason required.'));
  W('delivery/index.html', proseDoc(C.DELIVERY, 'delivery', 'How Tilecraft Art packs are delivered: an instant license key, then downloads in the Tilecraft Studio.'));
  W('disclaimer/index.html', proseDoc(C.DISCLAIMER, 'disclaimer', 'File compatibility notes and independence statement for Tilecraft Art.'));
  W('about/index.html', proseDoc(C.ABOUT, 'about', 'What Tilecraft Art makes and why: original pixel art packs with previews rendered from the real files.'));
  W('accessibility/index.html', proseDoc(C.ACCESSIBILITY, 'accessibility', 'Accessibility features of the Tilecraft Art site and the Tilecraft Studio.'));
  W('faq/index.html', faqPage());
  W('contact/index.html', contactPage());
  W('404.html', notFound());
  const pub = ['', ...products.map(p => `products/${p.id}/`), 'unlock/', 'license/', 'terms/', 'privacy/', 'refunds/', 'delivery/', 'disclaimer/', 'about/', 'accessibility/', 'faq/', 'contact/'];
  W('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pub.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>2026-11-08</lastmod></url>`).join('\n')}\n</urlset>\n`);
  W('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);
  W('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" shape-rendering="crispEdges"><path fill="#3fd1bd" d="M4 1h4v1h2v2h1v4h-1v2H8v1H4v-1H2V8H1V4h1V2h2z"/><path fill="#1f8f84" d="M6 6h4v2H8v1H6zM2 6h2v2H2z"/><path fill="#fff7e6" d="M4 3h2v1H5v1H4z"/></svg>\n`);
  W('.nojekyll', '');
  return pub;
}

module.exports = { writeAll, SITE, COPY };
