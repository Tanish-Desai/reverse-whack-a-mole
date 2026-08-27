/* ============================================================
   Renders every mole frame headlessly via @napi-rs/canvas,
   using the exact drawing code the game ships (js/mole-art.js).

   Each frame is drawn into a generous scratch cell, alpha-trimmed
   to its tight bounding box, and written out with the offset from
   the hole-centre anchor preserved so the game can re-anchor it.

     node tools/sprites/render-frames.js [--scale N] [--out DIR]
   ============================================================ */
'use strict';

var fs = require('fs');
var path = require('path');
var { createCanvas } = require('@napi-rs/canvas');
var MoleArt = require('../../js/mole-art.js');
var { buildFrameList } = require('./frames.js');

/* Scratch cell, sized to hold the widest/tallest frame with margin.
   ANCHOR is the hole centre — the (x, y) drawMoleAt is called with. */
var CELL_W = 300, CELL_H = 380;
var ANCHOR_X = 150, ANCHOR_Y = 230;

function parseArgs(argv) {
  var a = { scale: 1, out: path.join(__dirname, '../../build/sprites') };
  for (var i = 2; i < argv.length; i++) {
    if (argv[i] === '--scale') a.scale = Number(argv[++i]);
    else if (argv[i] === '--out') a.out = path.resolve(argv[++i]);
  }
  if (!(a.scale > 0)) throw new Error('--scale must be a positive number');
  return a;
}

/* Tight bounding box of non-transparent pixels. Returns null if the
   frame is fully transparent. */
function alphaBounds(ctx, w, h) {
  var data = ctx.getImageData(0, 0, w, h).data;
  var minX = w, minY = h, maxX = -1, maxY = -1;
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function renderFrames(opts) {
  var scale = opts.scale;
  var w = Math.round(CELL_W * scale), h = Math.round(CELL_H * scale);
  var canvas = createCanvas(w, h);
  var ctx = canvas.getContext('2d');

  return buildFrameList(opts.variants).map(function (f) {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(scale, scale);
    /* shadow:false — the contact shadow is a ground effect the game
       composites separately, not part of the mole sprite. */
    var o = Object.assign({}, f.opts, { shadow: false });
    MoleArt.drawMoleAt(ctx, ANCHOR_X, ANCHOR_Y, f.rise, o);
    ctx.restore();

    var box = alphaBounds(ctx, w, h);
    if (!box) throw new Error('frame "' + f.name + '" rendered fully transparent');
    if (box.x === 0 || box.y === 0 || box.x + box.w === w || box.y + box.h === h) {
      throw new Error('frame "' + f.name + '" touches the scratch cell edge — it is being clipped; enlarge CELL_W/CELL_H');
    }

    /* Copy the trimmed region into its own buffer. */
    var trimmed = createCanvas(box.w, box.h);
    trimmed.getContext('2d').drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);

    return {
      name: f.name,
      variant: f.variant,
      clip: f.clip,
      index: f.index,
      w: box.w,
      h: box.h,
      /* Where the trimmed image's top-left sits relative to the hole
         centre, in sprite pixels. Draw at (holeX + offsetX, holeY + offsetY). */
      offsetX: box.x - ANCHOR_X * scale,
      offsetY: box.y - ANCHOR_Y * scale,
      buffer: trimmed.toBuffer('image/png'),
      canvas: trimmed
    };
  });
}

function main() {
  var args = parseArgs(process.argv);
  var frameDir = path.join(args.out, 'frames');
  fs.mkdirSync(frameDir, { recursive: true });

  var frames = renderFrames(args);
  frames.forEach(function (f) {
    fs.writeFileSync(path.join(frameDir, f.name + '.png'), f.buffer);
  });

  var manifest = {
    scale: args.scale,
    anchor: { x: ANCHOR_X, y: ANCHOR_Y },
    cell: { w: CELL_W, h: CELL_H },
    frames: frames.map(function (f) {
      return { name: f.name, variant: f.variant, clip: f.clip, index: f.index, w: f.w, h: f.h, offsetX: f.offsetX, offsetY: f.offsetY };
    })
  };
  fs.writeFileSync(path.join(args.out, 'frames.json'), JSON.stringify(manifest, null, 2));

  console.log('rendered ' + frames.length + ' frames at scale ' + args.scale + ' -> ' + path.relative(process.cwd(), frameDir));
}

module.exports = { renderFrames: renderFrames, CELL_W: CELL_W, CELL_H: CELL_H, ANCHOR_X: ANCHOR_X, ANCHOR_Y: ANCHOR_Y };

if (require.main === module) main();
