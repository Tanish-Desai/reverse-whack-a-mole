/* ============================================================
   Mole sprite, drawn parametrically on the pixel grid.

   Squash and stretch modulate the body's pixel radii directly
   rather than scaling a rendered image, so every frame lands on
   whole pixels and the silhouette stays crisp through the whole
   animation.
   ============================================================ */
'use strict';

var { Buf } = require('./raster.js');
var PAL = require('./palette.js');

/* Logical art size at rest. */
var BODY_RX = 15, BODY_RY = 16;

/* Canvas big enough for the widest squash plus outline margin. */
var W = 76, H = 64;
var CX = 38, CY = 31;

function drawMole(o) {
  o = o || {};
  var sx = o.sx === undefined ? 1 : o.sx;
  var sy = o.sy === undefined ? 1 : o.sy;
  var v = o.variant || 'base';
  var facing = o.facing || 1;
  var expr = o.expr || 'normal';

  var c = function (n) { return PAL.idx(n, v); };
  var b = new Buf(W, H);

  var rx = Math.max(3, Math.round(BODY_RX * sx));
  var ry = Math.max(3, Math.round(BODY_RY * sy));

  /* Feature offsets track the squash so the face stays anchored
     to the body instead of floating. */
  var fx = rx / BODY_RX, fy = ry / BODY_RY;

  /* Half-width of the body ellipse at row offset dy — lets detail
     attach to the actual silhouette instead of a guessed edge. */
  var halfAt = function (dy) {
    var k = 1 - (dy * dy) / (ry * ry);
    return k <= 0 ? 0 : Math.round(rx * Math.sqrt(k));
  };
  var px = function (n) { return Math.round(n * fx); };
  var py = function (n) { return Math.round(n * fy); };

  /* ---- ears (behind the head) ---- */
  var earX = px(10), earY = -py(14), earR = Math.max(2, Math.round(3 * Math.min(fx, fy)));
  [-1, 1].forEach(function (s) {
    b.circle(CX + s * earX, CY + earY, earR, c('fur_dk'));
    if (earR >= 3) b.circle(CX + s * earX, CY + earY - 1, earR - 2, c('belly_dk'));
  });

  /* ---- body: three flat bands, light from the upper left ---- */
  b.ellipse(CX, CY, rx, ry, c('fur_dk'));
  b.ellipse(CX, CY - 1, rx - 1, ry - 1, c('fur_md'));
  b.ellipse(CX - Math.round(rx * 0.28), CY - Math.round(ry * 0.30),
            Math.round(rx * 0.55), Math.round(ry * 0.50), c('fur_lt'));

  /* ---- muzzle ---- */
  var mzY = py(5);
  b.ellipse(CX, CY + mzY, px(8), py(5), c('belly_dk'));
  b.ellipse(CX, CY + mzY - 1, px(7), py(4), c('belly_lt'));

  /* ---- eyes ---- */
  var eyX = px(5), eyY = -py(5);
  if (expr === 'dazed') {
    [-1, 1].forEach(function (s) {
      var x = CX + s * eyX, y = CY + eyY;
      b.line(x - 2, y - 2, x + 2, y + 2, c('eye_dk'));
      b.line(x + 2, y - 2, x - 2, y + 2, c('eye_dk'));
    });
  } else if (expr === 'closed') {
    [-1, 1].forEach(function (s) {
      var x = CX + s * eyX, y = CY + eyY;
      b.hline(x - 2, y, 5, c('eye_dk'));
      b.set(x - 3, y - 1, c('eye_dk'));
      b.set(x + 3, y - 1, c('eye_dk'));
    });
  } else {
    var look = facing * 1;
    [-1, 1].forEach(function (s) {
      var x = CX + s * eyX, y = CY + eyY;
      b.ellipse(x, y, 2, 2, c('eye_wht'));
      b.rect(x - 1 + look, y - 1, 2, 2, c('eye_dk'));
    });
  }

  /* ---- nose ---- */
  var nsY = CY + py(2);
  b.ellipse(CX, nsY, 2, 1, c('nose_dk'));
  b.hline(CX - 1, nsY - 1, 2, c('nose_lt'));

  /* ---- mouth ---- */
  var moY = CY + py(6);
  if (expr === 'dazed') {
    b.hline(CX - 1, moY, 3, c('outline'));
    b.set(CX - 2, moY - 1, c('outline'));
    b.set(CX + 2, moY - 1, c('outline'));
  } else {
    b.set(CX - 2, moY, c('outline'));
    b.set(CX + 2, moY, c('outline'));
    b.hline(CX - 1, moY + 1, 3, c('outline'));
  }

  /* ---- front teeth: the detail that reads "mole" at this size ---- */
  b.rect(CX - 2, moY + 2, 2, 2, c('eye_wht'));
  b.rect(CX + 1, moY + 2, 2, 2, c('eye_wht'));
  b.vline(CX, moY + 2, 2, c('outline'));

  /* ---- paws ---- */
  var pawY = CY + ry - py(3), pawX = px(8);
  [-1, 1].forEach(function (s) {
    var x = CX + s * pawX;
    b.ellipse(x, pawY, 4, 3, c('belly_dk'));
    b.ellipse(x, pawY - 1, 3, 2, c('belly_lt'));
    b.set(x - 1, pawY + 1, c('fur_dk'));
    b.set(x + 1, pawY + 1, c('fur_dk'));
  });

  /* ---- decoy wind-up key ---- */
  if (v === 'decoy') {
    b.vline(CX, CY - ry - 4, 4, c('teal_dk'));
    b.circle(CX - 2, CY - ry - 5, 2, c('teal_dk'));
    b.circle(CX + 2, CY - ry - 5, 2, c('teal_dk'));
  }

  b.outline(c('outline'), true);

  /* Whiskers go on after the outline pass, otherwise the auto-outline
     wraps each hair and they read as solid planks. */
  [-1, 1].forEach(function (sgn) {
    [py(2), py(5)].forEach(function (dy, i) {
      var edge = CX + sgn * (halfAt(dy) + 1);
      var len = 3 - i;
      for (var k = 0; k < len; k++) b.poke(edge + sgn * (k + 1), CY + dy, c('outline'));
    });
  });

  /* Orbiting daze stars. Pixel stars are drawn as plus-shapes —
     anything smaller than 3x3 reads as noise at this scale. */
  if (expr === 'dazed') {
    var t = o.t || 0;
    for (var si = 0; si < 3; si++) {
      var ang = t + (si / 3) * Math.PI * 2;
      var sxp = CX + Math.round(Math.cos(ang) * 15);
      var syp = CY - ry - 4 + Math.round(Math.sin(ang) * 4);
      b.poke(sxp, syp, PAL.INDEX.gold_lt);
      b.poke(sxp - 1, syp, PAL.INDEX.gold_md);
      b.poke(sxp + 1, syp, PAL.INDEX.gold_md);
      b.poke(sxp, syp - 1, PAL.INDEX.gold_md);
      b.poke(sxp, syp + 1, PAL.INDEX.gold_md);
    }
  }

  /* Catchlight last so nothing overwrites it. */
  if (expr === 'normal') {
    var exl = px(5), eyl = -py(5), lk = facing * 1;
    [-1, 1].forEach(function (sgn) {
      b.poke(CX + sgn * exl - 1 + lk, CY + eyl - 1, c('eye_wht'));
    });
  }

  return b;
}

module.exports = { drawMole: drawMole, W: W, H: H, CX: CX, CY: CY, BODY_RX: BODY_RX, BODY_RY: BODY_RY };
