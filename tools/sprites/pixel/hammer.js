/* ============================================================
   The hammer.

   Oriented the way the game uses it: head at the BOTTOM (the
   impact end), handle rising above it. The anchor is the head
   centre, matching the origin the game rotates and scales the
   hammer around during a strike.
   ============================================================ */
'use strict';

var { Buf } = require('./raster.js');
var PAL = require('./palette.js');

var W = 54, H = 94;
var CX = 27;
var HEAD_Y = 76, HEAD_RX = 19, HEAD_RY = 13;   /* anchor = (CX, HEAD_Y) */

var c = function (n) { return PAL.INDEX[n]; };

function drawHammer() {
  var b = new Buf(W, H);
  var hy = HEAD_Y, hrx = HEAD_RX, hry = HEAD_RY;

  /* ---- handle (drawn first so the head overlaps it) ---- */
  var top = 6, bot = hy;
  b.rect(CX - 4, top, 9, bot - top, c('dirt_md'));
  b.vline(CX - 4, top, bot - top, c('dirt_lt'));
  b.vline(CX - 3, top, bot - top, c('dirt_lt'));
  b.vline(CX + 4, top, bot - top, c('dirt_dk'));

  /* flared grip at the top of the handle */
  b.rect(CX - 6, top, 13, 11, c('dirt_md'));
  b.vline(CX - 6, top, 11, c('dirt_lt'));
  b.vline(CX - 5, top, 11, c('dirt_lt'));
  b.vline(CX + 6, top, 11, c('dirt_dk'));
  b.hline(CX - 6, top, 13, c('dirt_pl'));
  b.hline(CX - 6, top + 10, 13, c('dirt_dk'));

  /* ---- head: rounded barrel ---- */
  b.rect(CX - hrx + 5, hy - hry, (hrx - 5) * 2, hry * 2 + 1, c('dirt_lt'));
  b.ellipse(CX - hrx + 5, hy, 6, hry, c('dirt_lt'));
  b.ellipse(CX + hrx - 5, hy, 6, hry, c('dirt_lt'));

  /* three flat bands, lit from the upper left */
  for (var x = CX - hrx; x <= CX + hrx; x++) {
    for (var y = hy - hry; y <= hy + hry; y++) {
      if (b.get(x, y) === -1) continue;
      var d = (y - hy) / hry;
      b.poke(x, y, d < -0.45 ? c('dirt_pl') : (d > 0.45 ? c('dirt_md') : c('dirt_lt')));
    }
  }
  /* end caps read as end grain */
  [-1, 1].forEach(function (s) {
    var ex = CX + s * (hrx - 5);
    b.ellipse(ex, hy, 4, hry - 3, c('dirt_md'));
    b.ellipse(ex, hy - 1, 3, hry - 5, c('dirt_lt'));
  });

  /* ---- metal bands ---- */
  [-8, 8].forEach(function (ox) {
    for (var y2 = hy - hry; y2 <= hy + hry; y2++) {
      for (var x2 = CX + ox - 2; x2 <= CX + ox + 2; x2++) {
        if (b.get(x2, y2) === -1) continue;
        var d2 = (y2 - hy) / hry;
        b.poke(x2, y2, d2 < -0.45 ? c('metal_lt') : (d2 > 0.45 ? c('metal_dk') : c('metal_md')));
      }
    }
  });

  b.outline(c('outline'), true);
  return b;
}

module.exports = { drawHammer: drawHammer, W: W, H: H, CX: CX, HEAD_Y: HEAD_Y, HEAD_RX: HEAD_RX, HEAD_RY: HEAD_RY };
