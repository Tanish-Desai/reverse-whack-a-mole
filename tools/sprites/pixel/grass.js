/* ============================================================
   Grass field background.

   Deliberately low contrast: the HUD, hammer telegraphs and the
   mole all sit on top of this, and a busy ground plane destroys
   the readability of the red strike warnings.
   ============================================================ */
'use strict';

var { Buf } = require('./raster.js');
var PAL = require('./palette.js');

var c = function (n) { return PAL.INDEX[n]; };

function rng(seed) {
  var s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* Value noise on a coarse lattice, smoothed — gives soft irregular
   patches rather than per-pixel static. */
function valueNoise(w, h, cell, seed) {
  var r = rng(seed);
  var gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
  var g = new Float32Array(gw * gh);
  for (var i = 0; i < g.length; i++) g[i] = r();
  var sm = function (t) { return t * t * (3 - 2 * t); };
  return function (x, y) {
    var fx = x / cell, fy = y / cell;
    var x0 = Math.floor(fx), y0 = Math.floor(fy);
    var tx = sm(fx - x0), ty = sm(fy - y0);
    var a = g[y0 * gw + x0], b = g[y0 * gw + x0 + 1];
    var cc = g[(y0 + 1) * gw + x0], d = g[(y0 + 1) * gw + x0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty;
  };
}

function drawGrass(w, h) {
  var b = new Buf(w, h);
  var coarse = valueNoise(w, h, 26, 1337);
  var fine = valueNoise(w, h, 9, 4242);
  var r = rng(99);

  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      /* Patches stretch wider toward the bottom, matching the 3/4
         camera the rest of the set is drawn to. */
      var persp = 1 + (y / h) * 0.35;
      var n = coarse(x / persp, y) * 0.72 + fine(x / persp, y) * 0.28;
      b.poke(x, y, n < 0.47 ? c('grass_md') : c('grass_lt'));
    }
  }

  /* sparse pale tufts */
  for (var i = 0; i < Math.round(w * h / 900); i++) {
    var tx = Math.floor(r() * w), ty = Math.floor(r() * h);
    b.poke(tx, ty, c('grass_pl'));
    if (r() < 0.5) b.poke(tx, ty - 1, c('grass_pl'));
    if (r() < 0.3) b.poke(tx + 1, ty, c('grass_lt'));
  }

  /* individual blades, kept sparse */
  for (var j = 0; j < Math.round(w * h / 900); j++) {
    var bx = Math.floor(r() * w), by = Math.floor(r() * h);
    var len = 2 + Math.floor(r() * 2);
    for (var k = 0; k < len; k++) b.poke(bx, by - k, c('grass_dk'));
    b.poke(bx + 1, by - 1, c('grass_dk'));
  }

  /* a few flat stones */
  for (var s = 0; s < Math.round(w * h / 22000); s++) {
    var sx = Math.floor(r() * w), sy = Math.floor(r() * h);
    b.ellipse(sx, sy, 2, 1, c('metal_md'));
    b.poke(sx, sy - 1, c('metal_lt'));
    b.poke(sx, sy + 1, c('metal_dk'));
  }

  return b;
}

module.exports = { drawGrass: drawGrass };
