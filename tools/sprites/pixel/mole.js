/* ============================================================
   Mole sprite, drawn parametrically on the pixel grid.

   Modelled on the reference art: a rounded dome body with no
   visible ears, oversized eyes with heavy black pupils, a large
   black nose over two freckled cream muzzle lobes, prominent
   buck teeth, long whiskers reaching well outside the silhouette,
   and two clawed cream paws resting on the rim.

   Squash and stretch modulate the body's pixel radii directly
   rather than scaling a rendered image, so every frame lands on
   whole pixels.
   ============================================================ */
'use strict';

var { Buf } = require('./raster.js');
var PAL = require('./palette.js');

/* Logical art size at rest. The body is a capsule: a dome of
   BODY_RX radius on top of straight sides down to BODY_RY. */
var BODY_RX = 17, BODY_RY = 18;

/* Canvas big enough for the widest squash, the whiskers and the
   hurt lump, plus outline margin. */
var W = 92, H = 80;
var CX = 46, CY = 40;

function drawMole(o) {
  o = o || {};
  var sx = o.sx === undefined ? 1 : o.sx;
  var sy = o.sy === undefined ? 1 : o.sy;
  var v = o.variant || 'base';
  var facing = o.facing || 1;
  var expr = o.expr || 'normal';
  var t = o.t || 0;

  var c = function (n) { return PAL.idx(n, v); };
  var b = new Buf(W, H);

  var rx = Math.max(4, Math.round(BODY_RX * sx));
  var ry = Math.max(4, Math.round(BODY_RY * sy));

  /* Feature offsets track the squash so the face stays anchored. */
  var fx = rx / BODY_RX, fy = ry / BODY_RY;
  var px = function (n) { return Math.round(n * fx); };
  var py = function (n) { return Math.round(n * fy); };

  var top = CY - ry;
  var domeR = Math.min(rx, ry);
  var domeCY = top + domeR;

  /* Half-width of the silhouette at an absolute row — lets whiskers
     and paws attach to the real edge rather than a guessed one. */
  function halfAt(y) {
    if (y < domeCY) {
      var d = (y - domeCY) / domeR;
      var k = 1 - d * d;
      return k <= 0 ? 0 : Math.round(rx * Math.sqrt(k));
    }
    return rx;
  }

  /* ---- body: dome over straight sides, three flat bands ---- */
  b.ellipse(CX, domeCY, rx, domeR, c('fur_dk'));
  b.rect(CX - rx, domeCY, rx * 2 + 1, (CY + ry) - domeCY, c('fur_dk'));
  /* inset one pixel for the mid tone, leaving a dark rim */
  b.ellipse(CX, domeCY, rx - 1, domeR - 1, c('fur_md'));
  b.rect(CX - rx + 1, domeCY, (rx - 1) * 2 + 1, (CY + ry) - domeCY, c('fur_md'));
  /* the reference keeps the body flat mid-brown with a darker cap over
     the crown and only a small highlight, not a broad lit dome */
  b.halfEllipse(CX, domeCY, rx - 1, domeR - 1, c('fur_dk'), 'top');
  b.halfEllipse(CX, domeCY + 2, rx - 2, domeR - 2, c('fur_md'), 'top');
  b.ellipse(CX - Math.round(rx * 0.34), domeCY - Math.round(domeR * 0.30),
            Math.round(rx * 0.26), Math.round(domeR * 0.20), c('fur_lt'));

  /* ---- brows ---- */
  var eyX = px(7), eyY = CY - py(5);
  var browY = eyY - py(6);
  [-1, 1].forEach(function (s) {
    var x = CX + s * eyX;
    if (expr === 'hurt') {
      /* pinched inward and down */
      for (var i = 0; i < 5; i++) b.set(x - s * 2 + s * i, browY + 1 + Math.floor(i * 0.7), c('fur_dk'));
    } else {
      b.hline(x - 2, browY, 5, c('fur_dk'));
      b.set(x - 3, browY + 1, c('fur_dk'));
      b.set(x + 3, browY + 1, c('fur_dk'));
    }
  });

  /* ---- eyes ---- */
  [-1, 1].forEach(function (s) {
    var x = CX + s * eyX;
    if (expr === 'hurt') {
      /* squeezed shut: two strokes converging toward the nose */
      for (var i = 0; i < 4; i++) {
        b.set(x - s * 3 + s * i, eyY - 3 + i, c('eye_dk'));
        b.set(x - s * 3 + s * i, eyY + 3 - i, c('eye_dk'));
      }
    } else if (expr === 'closed') {
      b.hline(x - 3, eyY, 7, c('eye_dk'));
      b.set(x - 4, eyY - 1, c('eye_dk'));
      b.set(x + 4, eyY - 1, c('eye_dk'));
    } else {
      b.ellipse(x, eyY, 4, 4, c('eye_wht'));
      var look = facing * 1;
      b.ellipse(x + look, eyY + 1, 2, 3, c('eye_dk'));
      b.set(x + look - 1, eyY - 1, c('eye_wht'));
    }
  });

  /* ---- muzzle lobes, freckled ---- */
  var mzY = CY + py(6);
  [-1, 1].forEach(function (s) {
    var x = CX + s * px(5);
    b.ellipse(x, mzY, 7, 5, c('belly_dk'));
    b.ellipse(x, mzY - 1, 6, 4, c('belly_lt'));
  });
  [-1, 1].forEach(function (s) {
    var x = CX + s * px(7);
    b.set(x - 1, mzY - 1, c('belly_dk'));
    b.set(x + 2, mzY + 1, c('belly_dk'));
    b.set(x - 2, mzY + 2, c('belly_dk'));
  });

  /* ---- nose: large, black, with a shine ---- */
  var nsY = CY + py(2);
  b.ellipse(CX, nsY, 4, 3, c('nose_dk'));
  b.ellipse(CX, nsY + 1, 2, 1, c('nose_dk'));
  b.set(CX - 2, nsY - 2, c('eye_wht'));
  b.set(CX - 1, nsY - 2, c('nose_lt'));

  /* ---- buck teeth ---- */
  var thY = mzY + 3;
  b.rect(CX - 4, thY, 4, 6, c('eye_wht'));
  b.rect(CX + 1, thY, 4, 6, c('eye_wht'));
  b.vline(CX, thY, 6, c('outline'));

  /* ---- paws on the rim, three claws each. Drawn before the outline
     pass but with their own rim, so they read as separate from the
     body the way the reference does. ---- */
  var pawY = CY + ry - py(3), pawX = px(9);
  [-1, 1].forEach(function (s) {
    var x = CX + s * pawX;
    b.ellipse(x, pawY, 5, 4, c('outline'));
    b.ellipse(x, pawY, 4, 3, c('belly_dk'));
    b.ellipse(x, pawY - 1, 3, 2, c('belly_lt'));
    for (var k = -1; k <= 1; k++) b.vline(x + k * 2, pawY + 1, 3, c('outline'));
  });

  b.outline(c('outline'), true);

  /* ---- whiskers: three a side, drawn after outlining so the
     auto-outline cannot fatten them into planks ---- */
  [-1, 1].forEach(function (s) {
    [[py(2), 12, -1], [py(6), 13, 0], [py(10), 11, 1]].forEach(function (w) {
      var y = CY + w[0], len = w[1], slope = w[2];
      var edge = CX + s * (halfAt(y) + 1);
      for (var k = 0; k < len; k++) {
        b.poke(edge + s * (k + 1), y + slope * Math.floor(k / 3), c('outline'));
      }
    });
  });

  /* ---- the lump a hammer leaves ---- */
  if (expr === 'hurt') {
    var bx = CX + px(7), by = top + 2;
    b.ellipse(bx, by, 6, 5, c('outline'));
    b.ellipse(bx, by, 5, 4, c('red_md'));
    b.ellipse(bx - 1, by - 1, 3, 2, c('red_lt'));
    b.set(bx - 2, by - 2, c('eye_wht'));
    /* Impact ticks sweep around the lump. A symmetric pulse aliased
       into duplicate frames, so they rotate instead, from unevenly
       spaced starts that cannot line up with the 3-fold symmetry. */
    [[-1.15, 4], [-0.40, 3], [0.30, 4]].forEach(function (a) {
      var ang = a[0] + t;
      for (var k = 2; k < 2 + a[1]; k++) {
        b.poke(bx + Math.round(Math.cos(ang) * (6 + k)), by + Math.round(Math.sin(ang) * (5 + k)), c('red_dk'));
      }
    });
  }

  return b;
}

module.exports = { drawMole: drawMole, W: W, H: H, CX: CX, CY: CY, BODY_RX: BODY_RX, BODY_RY: BODY_RY };
