/* ============================================================
   Burrow holes: open, near-lip overlay, and boarded.

   The open hole ships as two pieces. The game draws `hole` first,
   then the mole, then `hole_front` on top, so the mole is genuinely
   occluded by the near rim as it sinks instead of floating over it.
   ============================================================ */
'use strict';

var { Buf } = require('./raster.js');
var PAL = require('./palette.js');

/* Logical geometry. The void's 22:9 radii give the ~2.1:1 ellipse
   the style contract calls for. */
var W = 68, H = 40;
var CX = 34, CY = 20;
var VOID_RX = 22, VOID_RY = 9;
var MOUND_RX = 30, MOUND_RY = 14;

var c = function (n) { return PAL.INDEX[n]; };

/* Deterministic jitter so tufts and clods look scattered but the
   asset regenerates identically every time. */
function rng(seed) {
  var s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function mound(b) {
  b.ellipse(CX, CY + 1, MOUND_RX, MOUND_RY, c('dirt_dk'));
  b.ellipse(CX, CY, MOUND_RX - 1, MOUND_RY - 1, c('dirt_md'));
  /* lit back slope */
  b.halfEllipse(CX, CY - 1, MOUND_RX - 3, MOUND_RY - 2, c('dirt_lt'), 'top');
  /* scattered clods on the rim */
  var r = rng(7);
  for (var i = 0; i < 14; i++) {
    var a = r() * Math.PI * 2;
    var rr = 0.80 + r() * 0.18;
    var x = Math.round(CX + Math.cos(a) * MOUND_RX * rr);
    var y = Math.round(CY + Math.sin(a) * MOUND_RY * rr);
    b.set(x, y, r() < 0.5 ? c('dirt_pl') : c('dirt_dk'));
  }
}

function voidHole(b) {
  /* dark interior, with a faint lit rim on the far wall only */
  b.ellipse(CX, CY, VOID_RX, VOID_RY, c('dirt_dk'));
  b.ellipse(CX, CY + 1, VOID_RX - 1, VOID_RY - 1, c('void'));
  b.halfEllipse(CX, CY - 1, VOID_RX - 2, VOID_RY - 2, c('dirt_dk'), 'top');
  b.ellipse(CX, CY + 1, VOID_RX - 3, VOID_RY - 2, c('void'));
}

/* Blades sit just outside the mound and are poked in after the
   outline pass — outlining them individually turns each tuft into a
   black-bordered speck. */
function grassFringe(b) {
  var r = rng(19);
  for (var i = 0; i < 30; i++) {
    var a = r() * Math.PI * 2;
    var x = Math.round(CX + Math.cos(a) * (MOUND_RX + 1));
    var y = Math.round(CY + Math.sin(a) * (MOUND_RY + 1));
    var col = r() < 0.35 ? c('grass_lt') : c('grass_md');
    var tall = 1 + Math.floor(r() * 2);
    /* A blade must grow out of solid ground. Without this, clipped
       pieces like hole_front end up with tufts floating in mid-air. */
    if (b.get(x, y + 1) === -1) continue;
    for (var k = 0; k < tall; k++) b.poke(x, y - k, col);
    if (r() < 0.45) b.poke(x + (r() < 0.5 ? 1 : -1), y, c('grass_dk'));
  }
}

/* Open hole, back piece: mound + interior. */
function drawHole() {
  var b = new Buf(W, H);
  mound(b);
  voidHole(b);
  b.outline(c('outline'), true);
  grassFringe(b);
  return b;
}

/* Near lip only — composites over the mole for occlusion. */
function drawHoleFront() {
  var full = new Buf(W, H);
  mound(full);

  /* Keep only the mound rows below the void's lower edge. */
  var b = new Buf(W, H);
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < W; x++) {
      var dy = y - CY;
      if (dy < 0) continue;
      var k = 1 - (dy * dy) / (VOID_RY * VOID_RY);
      var half = k <= 0 ? 0 : VOID_RX * Math.sqrt(k);
      var dx = Math.abs(x - CX);
      /* inside the void's horizontal span, only keep the front slope */
      if (dx < half && dy < VOID_RY) continue;
      b.poke(x, y, full.get(x, y));
    }
  }
  b.outline(c('outline'), true);
  grassFringe(b);
  return b;
}

/* Boarded hole — the GRID LOCKDOWN wildcard. */
function drawHoleBoarded() {
  var b = new Buf(W, H);
  mound(b);
  voidHole(b);

  /* Three rough planks, uneven so they read as salvage, each with
     nail heads at both ends. */
  var planks = [
    { y: CY - 7, len: 27, dx: -1 },
    { y: CY - 1, len: 30, dx: 1 },
    { y: CY + 5, len: 26, dx: 0 }
  ];
  planks.forEach(function (p) {
    var x0 = CX + p.dx - p.len, w = p.len * 2;
    b.rect(x0, p.y, w, 5, c('dirt_lt'));
    b.hline(x0, p.y, w, c('dirt_pl'));           /* lit top edge  */
    b.hline(x0, p.y + 4, w, c('dirt_md'));       /* shadow bottom */
    b.hline(x0, p.y + 5, w, c('dirt_dk'));       /* cast shadow onto the next */
    /* nail heads */
    [x0 + 2, x0 + w - 3].forEach(function (nx) {
      b.rect(nx, p.y + 1, 2, 2, c('metal_md'));
      b.set(nx, p.y + 1, c('metal_lt'));
    });
  });

  b.outline(c('outline'), true);
  grassFringe(b);
  return b;
}

module.exports = {
  drawHole: drawHole, drawHoleFront: drawHoleFront, drawHoleBoarded: drawHoleBoarded,
  W: W, H: H, CX: CX, CY: CY, VOID_RX: VOID_RX, VOID_RY: VOID_RY
};
