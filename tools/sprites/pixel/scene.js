/* Composite the whole pixel set into a game-scale scene.

   Everything is assembled in one logical-resolution buffer and
   upscaled exactly once, so every asset lands on the same pixel
   grid. Assets that look fine alone can still disagree about
   camera, palette or scale once they share a frame — this is the
   check for that.
   ============================================================ */
'use strict';

var { Buf, T } = require('./raster.js');
var { bufToCanvas } = require('./png.js');
var HOLES = require('./holes.js');
var MOLE = require('./mole.js');
var HAMMER = require('./hammer.js');
var GRASS = require('./grass.js');

var SCALE = 3;
var VW = 1280, VH = 720;
var LW = Math.ceil(VW / SCALE), LH = Math.ceil(VH / SCALE);

/* Grid geometry, mirrored from buildGrid() in js/game.js */
var COLS = 4, ROWS = 3;
var SPACING_X = 232, SPACING_Y = 176;
var ARENA_CX = 640, ARENA_CY = 440;

function holePositions() {
  var out = [];
  for (var r = 0; r < ROWS; r++) {
    for (var col = 0; col < COLS; col++) {
      out.push({
        x: (ARENA_CX + (col - (COLS - 1) / 2) * SPACING_X) / SCALE,
        y: (ARENA_CY + (r - (ROWS - 1) / 2) * SPACING_Y) / SCALE
      });
    }
  }
  return out;
}

/* Blit `src` so its anchor (ax, ay) lands on logical (x, y). */
function place(dst, src, ax, ay, x, y) {
  dst.blit(src, Math.round(x) - ax, Math.round(y) - ay);
}

/* Clip a mole to the hole mouth: anything below the void's front
   edge is inside the burrow and must not be drawn. Without this a
   sinking mole's paws hang out under the rim. */
function clipToHole(mole, moleX, moleY, holeX, holeY) {
  var out = new Buf(mole.w, mole.h);
  for (var by = 0; by < mole.h; by++) {
    for (var bx = 0; bx < mole.w; bx++) {
      var v = mole.get(bx, by);
      if (v === T) continue;
      /* logical world position of this pixel */
      var wx = Math.round(moleX) - MOLE.CX + bx;
      var wy = Math.round(moleY) - MOLE.CY + by;
      var dx = (wx - Math.round(holeX)) / HOLES.VOID_RX;
      var k = 1 - dx * dx;
      var frontY = Math.round(holeY) + (k <= 0 ? 0 : HOLES.VOID_RY * Math.sqrt(k));
      if (wy > frontY) continue;
      out.poke(bx, by, v);
    }
  }
  return out;
}

function renderScene(opts) {
  opts = opts || {};
  var b = GRASS.drawGrass(LW, LH);

  var pos = holePositions();
  var hole = HOLES.drawHole();
  var front = HOLES.drawHoleFront();
  var boarded = HOLES.drawHoleBoarded();

  var boardedCells = opts.boarded || [3, 9];
  var moles = opts.moles || [
    { cell: 4, rise: 1 }, { cell: 5, rise: 0.62 },
    { cell: 6, rise: 0.28, opts: { expr: 'closed' } },
    { cell: 8, rise: 1, opts: { variant: 'gold' } },
    { cell: 11, rise: 1, opts: { expr: 'hurt' } }
  ];

  pos.forEach(function (p, i) {
    if (boardedCells.indexOf(i) >= 0) return;
    place(b, hole, HOLES.CX, HOLES.CY, p.x, p.y);
  });

  moles.forEach(function (m) {
    var p = pos[m.cell];
    /* same rise mapping the game uses, in logical pixels */
    var cy = p.y + (34 - 76 * m.rise) / SCALE;
    var sprite = clipToHole(MOLE.drawMole(m.opts || {}), p.x, cy, p.x, p.y);
    place(b, sprite, MOLE.CX, MOLE.CY, p.x, cy);
    place(b, front, HOLES.CX, HOLES.CY, p.x, p.y);
  });

  boardedCells.forEach(function (i) {
    place(b, boarded, HOLES.CX, HOLES.CY, pos[i].x, pos[i].y);
  });

  if (opts.hammer !== false) {
    var hc = opts.hammerCell === undefined ? 7 : opts.hammerCell;
    var hp = pos[hc];
    place(b, HAMMER.drawHammer(), HAMMER.CX, HAMMER.HEAD_Y, hp.x, hp.y - 2);
  }

  return bufToCanvas(b, SCALE);
}

module.exports = { renderScene: renderScene, clipToHole: clipToHole, SCALE: SCALE, holePositions: holePositions, LW: LW, LH: LH };

if (require.main === module) {
  var fs = require('fs'), path = require('path');
  var out = path.join(__dirname, '../../../build/pixel/scene.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, renderScene().toBuffer('image/png'));
  console.log('scene -> ' + path.relative(process.cwd(), out));
}
