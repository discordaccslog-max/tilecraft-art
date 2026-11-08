/* Tilecraft Studio — writes Tiled .tmx maps that reference a pack's .tsx tilesets.
 * Save exported maps inside the pack's "tiled" folder so the tileset paths resolve. */
window.TCTiled = (function () {
  'use strict';
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
  /* layers: [{ name, data: [ {sheet, tile} | 0 ] }] */
  function tmx(meta, w, h, layers, variant) {
    var first = {}, gid = 1, sets = [];
    meta.sheets.forEach(function (s) {
      if (!s.tileset) return;
      first[s.id] = gid;
      var cols = s.columns, rows = s.height / s.cellHeight;
      sets.push(' <tileset firstgid="' + gid + '" source="' + esc(s.tiled.split('/').pop().replace('{variant}', variant || '')) + '"/>');
      gid += cols * rows;
    });
    var out = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<map version="1.10" tiledversion="1.11.0" orientation="orthogonal" renderorder="right-down" width="' + w + '" height="' + h + '" tilewidth="' + meta.tileSize + '" tileheight="' + meta.tileSize + '" infinite="0" nextlayerid="' + (layers.length + 1) + '" nextobjectid="1">'].concat(sets);
    layers.forEach(function (L, i) {
      out.push(' <layer id="' + (i + 1) + '" name="' + esc(L.name) + '" width="' + w + '" height="' + h + '">');
      out.push('  <data encoding="csv">');
      var rows = [];
      for (var y = 0; y < h; y++) { var r = []; for (var x = 0; x < w; x++) { var c = L.data[y * w + x]; r.push(c ? first[c.sheet] + c.tile : 0); } rows.push(r.join(',')); }
      out.push(rows.join(',\n'));
      out.push('</data>', ' </layer>');
    });
    out.push('</map>');
    return out.join('\n') + '\n';
  }
  return { tmx: tmx };
})();
