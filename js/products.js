/* Tilecraft Art — product list.
 * Product pages render their price and buy button from this file.
 * To start selling a product, paste its checkout link into checkoutUrl.
 * While checkoutUrl is empty, no buy button is shown on that product's page.
 * After payment, the checkout should send buyers to the product's thankYouPath
 * (relative to the site root, for example https://<your-site>/thank-you/meadowlands/). */
window.TILECRAFT_PRODUCTS = [
  { id: 'interface-essentials', code: 'UX', name: 'Interface Essentials', tier: 'Essentials', price: 10, thankYouPath: 'thank-you/interface-essentials/', checkoutUrl: '', packs: ['interface'] },
  { id: 'meadowlands', code: 'MD', name: 'Meadowlands Tileset', tier: 'Essentials', price: 12, thankYouPath: 'thank-you/meadowlands/', checkoutUrl: '', packs: ['meadowlands'] },
  { id: 'effects-particles', code: 'FX', name: 'Effects & Particles', tier: 'Essentials', price: 15, thankYouPath: 'thank-you/effects-particles/', checkoutUrl: '', packs: ['effects'] },
  { id: 'stonehollow', code: 'SH', name: 'Stonehollow Dungeon Tileset', tier: 'Essentials', price: 18, thankYouPath: 'thank-you/stonehollow/', checkoutUrl: '', packs: ['stonehollow'] },
  { id: 'hearthvale', code: 'HV', name: 'Hearthvale Town Tileset', tier: 'Essentials', price: 22, thankYouPath: 'thank-you/hearthvale/', checkoutUrl: '', packs: ['hearthvale'] },
  { id: 'character-kit', code: 'CK', name: 'Modular Character Kit', tier: 'Essentials', price: 29, thankYouPath: 'thank-you/character-kit/', checkoutUrl: '', packs: ['character-kit'] },
  { id: 'essentials-bundle', code: 'EB', name: 'Essentials Bundle', tier: 'Essentials', price: 59, thankYouPath: 'thank-you/essentials-bundle/', checkoutUrl: '', packs: ['interface', 'meadowlands', 'effects', 'stonehollow', 'hearthvale', 'character-kit'] },
  { id: 'ink-edition', code: 'NK', name: 'Ink Edition: 1-Bit World Kit', tier: 'Studio Edition', price: 39, thankYouPath: 'thank-you/ink-edition/', checkoutUrl: '', packs: ['ink-edition'] },
  { id: 'four-seasons', code: 'FS', name: 'Four Seasons Terrain Studio', tier: 'Studio Edition', price: 49, thankYouPath: 'thank-you/four-seasons/', checkoutUrl: '', packs: ['four-seasons'] },
  { id: 'grand-atlas', code: 'GA', name: 'Grand Atlas: Overworld Studio', tier: 'Studio Edition', price: 75, thankYouPath: 'thank-you/grand-atlas/', checkoutUrl: '', packs: ['grand-atlas'] }
];
