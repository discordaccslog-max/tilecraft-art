'use strict';
/* All written content for the site, the LICENSE.txt and README.txt files.
 * Tokens like {contact} become links on the site and plain words in text files. */
const UPDATED = 'November 8, 2026';

const DISCLOSURE = [
  'The art in these packs was created with AI assistance and drawn programmatically in code, pixel by pixel. No AI image generators were used, and no one else\'s artwork was used or traced.',
  'Some game stores and platforms ask developers to disclose AI-assisted content in their games. If you publish a game that uses these assets, follow the rules of the store or platform you publish on.'
];

const LICENSE_SUMMARY = {
  allowed: [
    'Use the assets in any number of games and apps you make',
    'Sell those games and apps commercially',
    'Use the assets in trailers, screenshots, store pages and promotion for those projects',
    'Modify, recolour and combine the assets however you like',
    'Skip attribution — credit is welcome but never required',
    'Use them as one person, or as one team or studio'
  ],
  notAllowed: [
    'Resell, share or redistribute the assets themselves, original or modified',
    'Include the assets in other asset packs, templates or game-making kits',
    'Use the assets in logos or trademarks',
    'Use the assets in NFTs or other crypto-tokens',
    'Use the assets to train AI models'
  ]
};

const LICENSE = {
  title: 'License',
  intro: 'This license applies to every pack sold by Tilecraft Art and to the free Mossway Sampler. It is written in plain language, and this page is the full license.',
  sections: [
    { h: 'Who the license is for', p: ['When you buy a pack, Tilecraft Art grants you a non-exclusive license to use its assets. "You" means the buyer: either one individual, or one team or studio. Everyone on that team may use the assets for the team\'s projects.'] },
    { h: 'What you can do', list: [
      'Use the assets in unlimited games and apps that you create, including commercial games and apps that you sell.',
      'Use the assets in trailers, screenshots, store pages and other promotional material for those games and apps.',
      'Modify, recolour, edit and combine the assets freely, with each other or with other art.',
      'Publish your games and apps on any platform, in any number of copies.'
    ] },
    { h: 'Attribution', p: ['No attribution is required. You don\'t need to credit Tilecraft Art anywhere, although you\'re welcome to.'] },
    { h: 'What you can\'t do', list: [
      'You may not resell, share, give away or redistribute the assets themselves, whether original or modified. This includes uploading the files where others can download them as assets.',
      'You may not include the assets, original or modified, in other asset packs, templates, tilesets, sprite collections or game-making kits, whether sold or free.',
      'You may not use the assets in logos or trademarks.',
      'You may not use the assets in NFTs or other crypto-tokens.',
      'You may not use the assets to train AI models, or include them in datasets used for that purpose.'
    ] },
    { h: 'Games that ship the files', p: ['Your finished games and apps will naturally contain the asset files. That\'s fine, as long as the assets are part of a playable game or app and are not offered on their own as a resource for others to use.'] },
    { h: 'How long the license lasts', p: ['The license is perpetual for assets you have already downloaded. If a purchase is refunded, the license for that purchase ends, and you should stop using and delete those assets.'] },
    { h: 'Licensed, not sold', p: ['The assets are licensed to you, not sold. Tilecraft Art keeps the copyright and all other rights in the assets.'] },
    { h: 'How these assets are made', p: DISCLOSURE },
    { h: 'Questions', p: ['If you\'re unsure whether a use is allowed, contact us through the {contact} before you rely on it.'] }
  ]
};

const TERMS = {
  title: 'Terms of Service',
  sections: [
    { h: 'Accepting these terms', p: ['By using this website, buying a pack, or using a license key, you agree to these terms. If you don\'t agree, please don\'t use the site or buy a pack.'] },
    { h: 'What we sell', p: ['Tilecraft Art sells digital game art packs and provides an online studio, the Tilecraft Studio, where you can preview, try out and download the packs you own. Packs are unlocked with a license key.'] },
    { h: 'Using the assets', p: ['How you may use the assets is set out on the {license}. That page forms part of these terms.'] },
    { h: 'Your license key', p: ['Each license key is for the buyer\'s own use. You may use your key on any number of your own devices. You may not share, publish, sell or transfer your key to anyone else.'] },
    { h: 'How the art is made', p: DISCLOSURE.concat(['You are responsible for following the disclosure rules of any store or platform where you publish a game or app that uses the assets.']) },
    { h: 'Compatibility', p: ['The files are provided in standard formats described on each product page. You are responsible for confirming that the files work with your chosen engine and tools before relying on them. See the {disclaimer} for details.'] },
    { h: 'Prices, taxes and payment', p: ['Prices are shown in US dollars. Payment is handled by a third-party payment provider at checkout, which also calculates and shows any applicable taxes before you pay. Tilecraft Art never sees your full card details.'] },
    { h: 'Delivery and refunds', p: ['How you receive your purchase is explained in the {delivery}. Refunds are covered by the {refunds}.'] },
    { h: 'Licensed, not sold', p: ['The assets are licensed to you, not sold. Tilecraft Art keeps all rights in the assets that are not expressly granted by the license.'] },
    { h: 'Warranties', p: ['The assets and the studio are provided "as is", without warranties of any kind, to the extent permitted by law. If you are a consumer, nothing in these terms limits rights you have under the law of the country where you live that cannot be excluded by contract.'] },
    { h: 'Liability', p: ['To the extent permitted by law, Tilecraft Art\'s total liability for any claim relating to a purchase is limited to the amount you paid for that purchase. Nothing in these terms limits liability that cannot be limited by law.'] },
    { h: 'Changes to these terms', p: ['We may update these terms from time to time. Changes are posted on this page with a new "Last updated" date. Changes don\'t affect purchases made before the change, and the license you received with a purchase stays as it was.'] },
    { h: 'Contact', p: ['Questions about these terms are welcome — contact us through the {contact}.'] }
  ]
};

const PRIVACY = {
  title: 'Privacy Policy',
  sections: [
    { h: 'The short version', p: ['This site uses no cookies, no analytics and no advertising trackers. Your license keys, saved maps, characters and settings stay in your own browser and are never sent to us or anyone else.'] },
    { h: 'What stays in your browser', p: ['The site and the Tilecraft Studio use your browser\'s local storage, only for things you ask them to do: keeping your library unlocked on this device, remembering your saved maps, characters and generator seeds, and remembering settings such as light or dark mode and the larger-interface option. This information is stored on your device and is never transmitted. You can remove your keys with "Sign out on this device" in the library, or clear everything through your browser\'s site data settings.'] },
    { h: 'Payments', p: ['Payments are handled by a third-party payment provider, which collects your payment details under its own privacy policy. Tilecraft Art never sees your full card details.'] },
    { h: 'Order information we receive', p: ['When you buy a pack, the payment provider shares order information with us: your name, email address, the products you bought and your country. We use it only to provide support, process refunds, and meet tax and accounting obligations.'] },
    { h: 'What we never do', p: ['We never sell your personal information, and we never share it for advertising.'] },
    { h: 'Hosting', p: ['The website is hosted on GitHub Pages. Like most web hosts, GitHub may process technical information such as IP addresses in its server logs to deliver and secure the site, under GitHub\'s own privacy statement. The site\'s fonts are served from this site, so viewing a page doesn\'t contact any font service.'] },
    { h: 'Your rights', p: ['Depending on where you live, including under the GDPR in the EU and UK and the CCPA in California, you have the right to access the personal information we hold about you, to correct it, to have it deleted, and to object to how we use it. You also have the right to complain to your local data protection authority. To exercise any of these rights, contact us through the {contact}. We\'ll respond within the time the law requires.'] },
    { h: 'How long we keep information', p: ['We keep order information only as long as we need it for support and refunds, and as long as tax and accounting law requires us to keep transaction records. After that, we delete it.'] },
    { h: 'Children', p: ['This site isn\'t directed at children under 13, and we don\'t knowingly collect personal information from them.'] },
    { h: 'Changes to this policy', p: ['If we change this policy, we\'ll update this page and its "Last updated" date. If a change affects how we use order information you\'ve already given us, we\'ll explain the change on this page before it takes effect.'] },
    { h: 'Contact', p: ['Questions about privacy? Contact us through the {contact}.'] }
  ]
};

const REFUNDS = {
  title: 'Refund Policy',
  sections: [
    { h: '14-day refunds, no reason needed', p: ['You can get a full refund on any purchase if you ask within 14 days of buying it. You don\'t need to give a reason, and it doesn\'t matter whether you\'ve downloaded the files.'] },
    { h: 'How to ask', p: ['Request a refund through the {contact}. Include your order number so we can find your purchase.'] },
    { h: 'When the money arrives', p: ['Refunds go back to your original payment method and are issued within 5 business days of your request. Your payment provider\'s processing time may add a few days before the money shows up.'] },
    { h: 'After a refund', p: ['When a purchase is refunded, the license for that purchase ends. Please stop using the assets from that purchase and delete them.'] },
    { h: 'Your legal rights', p: ['If you are a consumer in the EU or UK, the law gives you a 14-day right to withdraw from an online purchase. This policy honours refund requests within 14 days of purchase even after you have accessed or downloaded the files, so you don\'t have to give up that right to get instant access. This policy adds to, and never reduces, any rights you have under the law where you live.'] }
  ]
};

const DELIVERY = {
  title: 'Delivery Policy',
  sections: [
    { h: 'Everything is digital', p: ['All Tilecraft Art products are digital. There is no physical shipment.'] },
    { h: 'Your license key, right away', p: ['After payment, your license key appears immediately on the order confirmation page. Copy your key and save it somewhere safe, such as a password manager or a note.'] },
    { h: 'Opening your packs', p: ['Enter your key on the site\'s {unlock} and your packs open straight away in your library inside the Tilecraft Studio. There you can preview everything and download the full pack as a .zip file, or individual sheets. The same key works on any of your devices — just enter it again.'] },
    { h: 'Your downloads are yours', p: ['Files you download are yours to keep and use under the {license}.'] },
    { h: 'Lost your key?', p: ['Contact us through the {contact} with your order number and we\'ll send a replacement key.'] },
    { h: 'How long online access lasts', p: ['Online access to the Tilecraft Studio continues for as long as Tilecraft Art operates. Because downloaded files are yours to keep, we recommend downloading the .zip for each pack you own.'] }
  ]
};

const DISCLAIMER = {
  title: 'Disclaimer',
  sections: [
    { h: 'File compatibility', p: ['Files are provided in standard formats — PNG images, JSON metadata and Tiled tileset and map files — that work with most 2D game engines and tools. Every engine handles imports differently, so please check compatibility with your own setup before relying on the files. Each product page lists exactly which formats are included.'] },
    { h: 'Product names', p: ['Product names such as Tiled are mentioned only to describe file compatibility. Tilecraft Art is independent and is not affiliated with or endorsed by any game engine, tool maker, game store or game publisher.'] },
    { h: 'How the art is made', p: DISCLOSURE }
  ]
};

const ABOUT = {
  title: 'About Tilecraft Art',
  sections: [
    { h: 'What we make', p: ['Tilecraft Art makes original 2D pixel art packs for game developers: tilesets on a 16×16 grid, autotiling terrain, interface pieces, effects and modular characters. Every pack comes with a browser-based studio where you can look at each asset at real size, paint test maps, build characters and download the files.'] },
    { h: 'Why it works this way', p: ['Choosing game art is hard when previews are polished mock-ups. So everything you see on this site is rendered from the actual files you download: the scenes on the home page, the animated previews and the sheets on each product page. What you see is what you get.', 'Each pack is built to be used, not just looked at. Terrain tiles join seamlessly in every combination, animations loop cleanly, and every pack ships with metadata, Tiled files and a palette so you can drop it into your project.'] },
    { h: 'How the art is made', p: DISCLOSURE.concat(['Because the art is drawn in code, the build script checks every pack automatically: every pixel must come from the pack\'s palette, every autotile must join its neighbours, every animation must loop cleanly, and every sprite must sit on its grid. Anything that fails is redrawn.']) }
  ]
};

const ACCESSIBILITY = {
  title: 'Accessibility',
  sections: [
    { h: 'Our approach', p: ['We want the site and the Tilecraft Studio to work for everyone. Pages use semantic HTML and a logical heading order, and every control can be reached and used with a keyboard, with a visible focus outline.'] },
    { h: 'Features', list: [
      'Light and dark themes, following your system setting by default, with colours chosen to meet WCAG AA contrast.',
      'A larger-interface option in the studio that increases text and control sizes.',
      'Animations stop and still frames are shown when your system asks for reduced motion.',
      'In the map playground, you can move the painting cursor with the arrow keys and paint with Enter or Space.',
      'Pixel art is shown at whole-number scales so it stays sharp.'
    ] },
    { h: 'Something not working?', p: ['If anything on the site is hard to use with your setup, tell us through the {contact} and describe what happened. We\'ll work to fix it.'] }
  ]
};

const FAQ = [
  { q: 'How do license keys work?', a: ['After you pay, your order confirmation page creates your license key on the spot and shows it with a copy button. The key unlocks the pack (or packs) you bought. Keys look like TILE-, a two-letter product code, and three groups of letters and numbers.'], preview: true },
  { q: 'Where do I enter my key?', a: ['On the {unlock}. It\'s also linked from "Have a key?" at the top of every page. Once the key is accepted, your packs open in your library inside the Tilecraft Studio.'], preview: true },
  { q: 'Do I need to save my key?', a: ['Yes, please copy it and keep it somewhere safe, like a password manager or a note. You\'ll need it to open your packs on another device or browser.'] },
  { q: 'How do I download my packs?', a: ['Open a pack in the studio and go to Downloads. You can download the full pack as a .zip file, or any individual sheet at 1×, 2× or 4×.'] },
  { q: 'What\'s in each .zip?', a: ['PNG sprite sheets and an individual PNG for every asset, each at 1×, 2× and 4× (scaled with nearest-neighbour so pixels stay sharp); a JSON file listing every asset with its position, size and animation frames and timings; for tilesets, Tiled tileset files (.tsx) with autotiling rules and finished sample maps (.tmx); the palette as .hex and .gpl files; LICENSE.txt; and README.txt with the folder layout and import notes. Each product page lists the exact contents.'], preview: true },
  { q: 'Which engines and tools do the files work with?', a: ['The files use standard formats. The PNG sheets and JSON metadata can be loaded by practically any 2D engine or framework, and the .tsx and .tmx files open in Tiled and in engines that read Tiled files directly or through an importer. The README in each pack has import notes. Every engine imports differently, so please check the files with your own setup. Tilecraft Art isn\'t affiliated with or endorsed by any engine or tool.'] },
  { q: 'How does autotiling work?', a: ['Autotiling picks the right edge or corner tile for each cell from its neighbours, so you just paint "water" or "path" and the shoreline draws itself. Terrain sets use the 47-tile "blob" layout, which covers every combination of edges and corners; fences, rivers, roads and paths use a 16-tile connection layout. The Tiled files include these rules as terrain sets, the JSON lists the neighbour mask for every tile, and the studio\'s map playground applies them as you paint.'] },
  { q: 'Can I use the assets in commercial games?', a: ['Yes. You can use them in unlimited games and apps, including ones you sell, plus trailers, screenshots and store pages. No attribution is required. You can\'t resell or redistribute the assets themselves. The {license} has the details.'], preview: true },
  { q: 'Was the art made with AI?', a: DISCLOSURE },
  { q: 'Can I use my packs on more than one device?', a: ['Yes. Enter the same key on each of your devices. Keys are saved in each browser, and the library has a "Sign out on this device" button when you\'re done on a shared computer.'] },
  { q: 'What if I lose my key?', a: ['Contact us through the {contact} with your order number and the email you used at checkout, and we\'ll send you a replacement key.'] },
  { q: 'What\'s the difference between Essentials and Studio Editions?', a: ['Essentials are focused packs: one tileset, kit or effect set each. Studio Editions are larger, complete systems — Ink Edition is a full matched game kit in a two-colour style, Four Seasons has six biomes with full autotiling in four seasonal palettes, and Grand Atlas adds an overworld map generator to the studio. Each product page lists the exact contents so you can compare.'] },
  { q: 'Can my team use one purchase?', a: ['Yes. One purchase licenses one individual or one team or studio, and everyone on that team can use the assets in the team\'s projects. Please don\'t share your key outside your team.'] },
  { q: 'Can I get a refund?', a: ['Yes. Ask within 14 days of your purchase through the {contact} and include your order number — no reason needed. See the {refunds}.'], preview: true }
];

/* ---------- plain-text rendering for the zip ---------- */
const TXT_LINKS = { contact: 'Contact page on the Tilecraft Art website', license: 'License page', unlock: 'unlock page', refunds: 'Refund Policy', delivery: 'Delivery Policy', disclaimer: 'Disclaimer' };
const toText = s => s.replace(/\{(\w+)\}/g, (_, k) => 'the ' + (TXT_LINKS[k] || k).replace(/^the /, ''));
function wrap(text, width = 78) {
  const words = text.split(/\s+/), lines = []; let line = '';
  for (const w of words) { if ((line + ' ' + w).trim().length > width) { lines.push(line); line = w; } else line = (line + ' ' + w).trim(); }
  if (line) lines.push(line);
  return lines.join('\n');
}
function licenseText() {
  const out = ['TILECRAFT ART — ASSET LICENSE', `Last updated: ${UPDATED}`, '', wrap(LICENSE.intro), ''];
  for (const s of LICENSE.sections) {
    out.push(s.h.toUpperCase());
    for (const p of s.p || []) out.push(wrap(toText(p)), '');
    for (const li of s.list || []) out.push(wrap('- ' + toText(li)).replace(/\n/g, '\n  '));
    if (s.list) out.push('');
  }
  out.push('SUMMARY', 'Allowed:'); LICENSE_SUMMARY.allowed.forEach(a => out.push('  + ' + a));
  out.push('Not allowed:'); LICENSE_SUMMARY.notAllowed.forEach(a => out.push('  - ' + a));
  return out.join('\n') + '\n';
}

function readmeText(pack, meta, files) {
  const st = pack.stats();
  const dirs = [...new Set(files.map(f => f.split('/').slice(0, f.split('/')[0] === 'assets' || f.split('/')[0] === 'sheets' ? 2 : 1).join('/')))].sort();
  const L = [];
  L.push(`${pack.name.toUpperCase()}`, 'Tilecraft Art', '');
  L.push(wrap(`Thank you for your purchase. This pack contains ${st.assets} assets (${st.frames} frames in total${st.variants > 1 ? `, each in ${st.variants} palette variants` : ''}). All art is pixel art on a ${meta.tileSize}×${meta.tileSize} tile grid.`), '');
  L.push('FOLDER LAYOUT');
  const desc = {
    'sheets/1x': 'sprite sheets at original size', 'sheets/2x': 'sprite sheets at 2× (nearest-neighbour)', 'sheets/4x': 'sprite sheets at 4× (nearest-neighbour)',
    'assets/1x': 'every asset as its own PNG at original size (animations as horizontal strips)', 'assets/2x': 'every asset at 2×', 'assets/4x': 'every asset at 4×',
    'metadata': 'JSON listing every asset, its sheet position, size, animation frames and timings', 'palette': 'the palette as .hex and .gpl (GIMP, Aseprite, Krita and others)',
    'tiled': 'Tiled tilesets (.tsx) with autotiling terrain sets, and finished sample maps (.tmx)', 'maps': 'the sample maps rendered as PNG images', 'layers': 'one sprite sheet per character layer'
  };
  for (const d of dirs) if (!d.includes('.')) L.push(`  ${d.padEnd(12)} ${desc[d] || ''}`);
  L.push('  LICENSE.txt  the full license', '  README.txt   this file', '');
  L.push('TILE SIZE AND GRID');
  L.push(wrap(`Tiles are ${meta.tileSize}×${meta.tileSize} pixels. Sheets are laid out on that grid with no spacing or margins. Larger objects (trees, buildings, effects) span whole multiples of the grid. Positions in the JSON are given in pixels at 1×; multiply by 2 or 4 for the scaled sheets.`), '');
  if (pack.autotiles.length) {
    L.push('AUTOTILING');
    L.push(wrap('Terrain sets use the 47-tile "blob" layout. Each tile\'s "autotile.mask" in the JSON is an 8-bit neighbour mask: N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128, where a diagonal only counts when both of its neighbouring sides are set. To pick a tile, build the mask from a cell\'s neighbours and find the tile with that mask. Connection sets (fences, paths, rivers, roads) use a 16-tile layout with N=1, E=2, S=4, W=8.'));
    L.push(wrap('The .tsx files include these rules as Tiled terrain sets (Wang sets), so the Terrain brush in Tiled places the right tiles automatically. Blob terrain tiles have transparent surroundings, so they can be layered over any ground tile.'), '');
  }
  if (pack.variants) { L.push('PALETTE VARIANTS'); L.push(wrap(`Every sheet and asset comes in ${pack.variants.length} palette variants: ${pack.variants.map(v => v.name).join(', ')}. The file name ends with the variant id. Tiled files and sample maps exist for each variant.`), ''); }
  if (meta.characters) { L.push('CHARACTER LAYERS'); L.push(wrap('Each layer sheet has 4 rows (down, left, right, up) and 6 columns (walk frames 1–4, idle frames 1–2), with 16×32 frames. Stack layers in this order: body, outfit, hair, accessory. Use outfits and accessories made for the same body build. All layers line up frame for frame.'), ''); }
  L.push('IMPORTING INTO A GAME ENGINE');
  L.push(wrap('General: import the 1× sheets and scale your camera or window by whole numbers, with filtering turned off (nearest-neighbour). Or use the 2× or 4× files directly.'));
  L.push(wrap('Godot 4: set the default texture filter to Nearest (Project Settings > Rendering > Textures). Create a TileSet with a 16×16 tile size from a sheet, or import the .tmx through a Tiled importer add-on. Use the JSON frames for AnimatedSprite2D.'));
  L.push(wrap('Unity: set each sheet\'s Filter Mode to Point and Compression to None, Sprite Mode to Multiple, and slice by cell size 16×16 (or 16×32 for characters). Use the nineSlice values in the JSON as sprite borders for interface pieces.'));
  L.push(wrap('GameMaker: import sheets as sprites with "Split by grid", or as tile sets with 16×16 tiles. Turn off texture interpolation in the game options.'));
  L.push(wrap('Tiled: open any .tmx in the tiled folder. Keep the folder structure as it is, because the .tsx files point to ../sheets/1x/.'));
  L.push(wrap('Web frameworks (Phaser, PixiJS, LÖVE and others): load a 1× sheet and read frame rectangles from the JSON; set image smoothing off and use whole-number scales.'));
  L.push(wrap('Every engine handles imports a little differently, so please check the files with your own setup.'), '');
  L.push('HOW THESE ASSETS ARE MADE');
  for (const p of DISCLOSURE) L.push(wrap(p), '');
  L.push('LICENSE');
  L.push(wrap('Use these assets in unlimited games and apps you make, including commercial ones. No attribution required. Don\'t resell or redistribute the assets themselves, use them in logos, trademarks, NFTs or crypto-tokens, or use them to train AI models. See LICENSE.txt for the full license.'), '');
  L.push('HELP');
  L.push(wrap('Lost your key or found a problem? Contact us through the Contact page on the Tilecraft Art website.'));
  return L.join('\n') + '\n';
}

module.exports = { UPDATED, DISCLOSURE, LICENSE, LICENSE_SUMMARY, TERMS, PRIVACY, REFUNDS, DELIVERY, DISCLAIMER, ABOUT, ACCESSIBILITY, FAQ, licenseText, readmeText };
