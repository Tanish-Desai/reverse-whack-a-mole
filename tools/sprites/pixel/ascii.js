/* Debug helper: render an indexed Buf as ASCII so shapes can be
   judged without leaving the terminal. */
'use strict';
var PAL = require('./palette.js');
var { T } = require('./raster.js');

var GLYPH = {
  outline: '#', fur_dk: '%', fur_md: 'o', fur_lt: 'O',
  belly_dk: '=', belly_lt: '+', eye_wht: 'W', eye_dk: '@',
  nose_dk: 'n', nose_lt: 'N',
  dirt_dk: 'd', dirt_md: 'D', dirt_lt: 'L', dirt_pl: 'P', void: ' ',
  grass_dk: 'g', grass_md: 'G', grass_lt: '"', grass_pl: "'",
  metal_dk: 'm', metal_md: 'M', metal_lt: 'A',
  steel_dk: 'b', steel_md: 'B', steel_lt: 'l', steel_pl: 'L',
  gold_dk: '$', gold_md: 'S', gold_lt: 's',
  red_dk: 'r', red_md: 'R', red_lt: 'e'
};

function ascii(buf, variant) {
  var map = {};
  PAL.NAMES.forEach(function (n) { map[PAL.idx(n, variant)] = GLYPH[n] || '?'; });
  var out = [];
  for (var y = 0; y < buf.h; y++) {
    var row = '';
    for (var x = 0; x < buf.w; x++) {
      var v = buf.get(x, y);
      row += v === T ? '.' : (map[v] || '?');
    }
    out.push(row);
  }
  return out.join('\n');
}
module.exports = { ascii: ascii };
