/* ============================================================
   The hammer, at rest. The game animates the slam itself, so
   this is a single upright sprite: stubby barrel head over a
   flared handle, lit from the upper left.
   ============================================================ */
'use strict';

var { Buf } = require('./raster.js');
var PAL = require('./palette.js');

var W = 54, H = 92;
var CX = 27;
var c = function (n) { return PAL.INDEX[n]; };

function drawHammer() {
  var b = new Buf(W, H);

  /* ---- head: rounded barrel ---- */
  var hy = 18, hrx = 19, hry = 13;
  b.rect(CX - hrx + 5, hy - hry, (hrx - 5) * 2, hry * 2 + 1, c('dirt_lt'));
  b.ellipse(CX - hrx + 5, hy, 6, hry, c('dirt_lt'));
  b.ellipse(CX + hrx - 5, hy, 6, hry, c('dirt_lt'));

  /* three flat bands: lit top, body, shadowed underside */
  for (var x = CX - hrx; x <= CX + hrx; x++) {
    for (var y = hy - hry; y <= hy + hry; y++) {
      if (b.get(x, y) === -1) continue;
      var d = (y - hy) / hry;
      b.poke(x, y, d < -0.45 ? c('dirt_pl') : (d > 0.45 ? c('dirt_md') : c('dirt_lt')));
    }
  }
  /* end caps read as end grain */
  b.ellipse(CX - hrx + 5, hy, 4, hry - 3, c('dirt_md'));
  b.ellipse(CX - hrx + 5, hy - 1, 3, hry - 5, c('dirt_lt'));
  b.ellipse(CX + hrx - 5, hy, 4, hry - 3, c('dirt_md'));
  b.ellipse(CX + hrx - 5, hy - 1, 3, hry - 5, c('dirt_lt'));

  /* ---- metal bands ---- */
  [-8, 8].forEach(function (ox) {
    for (var y = hy - hry; y <= hy + hry; y++) {
      for (var x = CX + ox - 2; x <= CX + ox + 2; x++) {
        if (b.get(x, y) === -1) continue;
        var d = (y - hy) / hry;
        b.poke(x, y, d < -0.45 ? c('metal_lt') : (d > 0.45 ? c('metal_dk') : c('metal_md')));
      }
    }
  });

  /* ---- handle ---- */
  var top = hy + hry - 1, bot = H - 8;
  b.rect(CX - 4, top, 9, bot - top, c('dirt_md'));
  b.vline(CX - 4, top, bot - top, c('dirt_lt'));      /* lit left edge */
  b.vline(CX - 3, top, bot - top, c('dirt_lt'));
  b.vline(CX + 4, top, bot - top, c('dirt_dk'));      /* shadow right  */

  /* flared grip */
  b.rect(CX - 6, bot - 10, 13, 10, c('dirt_md'));
  b.vline(CX - 6, bot - 10, 10, c('dirt_lt'));
  b.vline(CX - 5, bot - 10, 10, c('dirt_lt'));
  b.vline(CX + 6, bot - 10, 10, c('dirt_dk'));
  b.hline(CX - 6, bot - 10, 13, c('dirt_pl'));
  b.hline(CX - 6, bot - 1, 13, c('dirt_dk'));

  b.outline(c('outline'), true);
  return b;
}

module.exports = { drawHammer: drawHammer, W: W, H: H, CX: CX };
