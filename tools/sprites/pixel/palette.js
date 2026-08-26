/* ============================================================
   Shared indexed palette.

   Every pixel asset draws only from this table, which is what
   makes the set consistent by construction rather than by eye.
   Ramps are 3-4 steps: dark / mid / light (/ pale highlight).

   Wood reuses the dirt ramp on purpose — same material family,
   fewer colours, more cohesion.
   ============================================================ */
'use strict';

/* name -> hex. Index order is the array order below. */
var RAMPS = {
  /* structural */
  outline:   '#241408',

  /* mole fur */
  fur_dk:    '#5b3a1d',
  fur_md:    '#8a5c33',
  fur_lt:    '#b07f47',
  belly_dk:  '#c9a074',
  belly_lt:  '#edd0a4',

  /* face */
  nose_dk:   '#1a1208',
  nose_lt:   '#4a3520',
  eye_wht:   '#ffffff',
  eye_dk:    '#120c06',

  /* the lump raised by a hammer */
  red_dk:    '#8c1f1f',
  red_md:    '#e33a3a',
  red_lt:    '#ff7a6e',

  /* dirt + wood (shared ramp) */
  dirt_dk:   '#3d2612',
  dirt_md:   '#6b4a28',
  dirt_lt:   '#92693c',
  dirt_pl:   '#b98a52',
  void:      '#150c05',

  /* grass */
  grass_dk:  '#3f8a32',
  grass_md:  '#57ad40',
  grass_lt:  '#74cc55',
  grass_pl:  '#96e070',

  /* metal — hammer bands */
  metal_dk:  '#4a4f5c',
  metal_md:  '#79808f',
  metal_lt:  '#a8b0be',

  /* gold variant */
  gold_dk:   '#c78a10',
  gold_md:   '#ffc93c',
  gold_lt:   '#ffe9a3'
};

var NAMES = Object.keys(RAMPS);
var INDEX = {};
NAMES.forEach(function (n, i) { INDEX[n] = i; });

var RGB = NAMES.map(function (n) {
  var h = RAMPS[n];
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
});

/* Variant remaps: swap the fur ramp for gold without duplicating a
   single line of the mole drawing code. */
var VARIANT_MAPS = {
  base: {},
  gold: {
    fur_dk: 'gold_dk', fur_md: 'gold_md', fur_lt: 'gold_lt',
    belly_dk: 'gold_md', belly_lt: 'gold_lt'
  }
};

/* Resolve a colour name through a variant map to a palette index. */
function idx(name, variant) {
  var map = VARIANT_MAPS[variant || 'base'] || {};
  return INDEX[map[name] || name];
}

module.exports = { RAMPS: RAMPS, NAMES: NAMES, INDEX: INDEX, RGB: RGB, VARIANT_MAPS: VARIANT_MAPS, idx: idx, SIZE: NAMES.length };
