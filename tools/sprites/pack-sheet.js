/* ============================================================
   Packs rendered mole frames into a single PNG spritesheet plus
   a JSON atlas of frame rects.

   Uses shelf packing (frames sorted tallest-first, laid in rows).
   Frames are padded apart so filtering cannot bleed neighbours in.

     node tools/sprites/pack-sheet.js [--scale N] [--width N] [--out DIR]
   ============================================================ */
'use strict';

var fs = require('fs');
var path = require('path');
var { createCanvas } = require('@napi-rs/canvas');
var { renderFrames, ANCHOR_X, ANCHOR_Y } = require('./render-frames.js');

var PAD = 2;

function parseArgs(argv) {
  var a = { scale: 1, width: 1024, out: path.join(__dirname, '../../build/sprites') };
  for (var i = 2; i < argv.length; i++) {
    if (argv[i] === '--scale') a.scale = Number(argv[++i]);
    else if (argv[i] === '--width') a.width = Number(argv[++i]);
    else if (argv[i] === '--out') a.out = path.resolve(argv[++i]);
  }
  return a;
}

/* Shelf packer: sort tallest-first, fill rows left to right. Returns
   placements plus the final sheet height. */
function shelfPack(frames, sheetW) {
  var order = frames.slice().sort(function (a, b) {
    return b.h - a.h || b.w - a.w || a.name.localeCompare(b.name);
  });
  var placed = [];
  var x = PAD, y = PAD, rowH = 0;

  order.forEach(function (f) {
    if (f.w + PAD * 2 > sheetW) {
      throw new Error('frame "' + f.name + '" is ' + f.w + 'px wide, wider than the sheet (' + sheetW + 'px) — raise --width');
    }
    if (x + f.w + PAD > sheetW) {   /* wrap to the next shelf */
      x = PAD;
      y += rowH + PAD;
      rowH = 0;
    }
    placed.push({ frame: f, x: x, y: y });
    x += f.w + PAD;
    if (f.h > rowH) rowH = f.h;
  });

  return { placed: placed, height: y + rowH + PAD };
}

/* Next power of two — keeps the texture GPU-friendly. */
function pot(n) {
  var p = 1;
  while (p < n) p *= 2;
  return p;
}

function pack(opts) {
  var frames = renderFrames({ scale: opts.scale, variants: opts.variants });
  var sheetW = opts.width;
  var result = shelfPack(frames, sheetW);
  var sheetH = pot(result.height);

  var sheet = createCanvas(sheetW, sheetH);
  var ctx = sheet.getContext('2d');

  var atlas = {
    image: 'mole-sheet.png',
    size: { w: sheetW, h: sheetH },
    scale: opts.scale,
    /* Anchor the frames were rendered around, in sprite pixels.
       offsetX/offsetY on each frame are already relative to it. */
    anchor: { x: ANCHOR_X * opts.scale, y: ANCHOR_Y * opts.scale },
    padding: PAD,
    frames: {},
    clips: {}
  };

  result.placed.forEach(function (p) {
    var f = p.frame;
    ctx.drawImage(f.canvas, p.x, p.y);
    atlas.frames[f.name] = {
      x: p.x, y: p.y, w: f.w, h: f.h,
      offsetX: f.offsetX, offsetY: f.offsetY
    };
  });

  /* Clip index, in playback order. */
  frames.forEach(function (f) {
    var key = f.variant + '.' + f.clip;
    (atlas.clips[key] = atlas.clips[key] || []).push({ name: f.name, index: f.index });
  });
  Object.keys(atlas.clips).forEach(function (k) {
    atlas.clips[k] = atlas.clips[k]
      .sort(function (a, b) { return a.index - b.index; })
      .map(function (e) { return e.name; });
  });

  return { atlas: atlas, buffer: sheet.toBuffer('image/png'), frameCount: frames.length, usedHeight: result.height };
}

function main() {
  var args = parseArgs(process.argv);
  fs.mkdirSync(args.out, { recursive: true });

  var r = pack(args);
  fs.writeFileSync(path.join(args.out, 'mole-sheet.png'), r.buffer);
  fs.writeFileSync(path.join(args.out, 'mole-atlas.json'), JSON.stringify(r.atlas, null, 2));

  var fill = (r.usedHeight / r.atlas.size.h * 100).toFixed(1);
  console.log('packed ' + r.frameCount + ' frames into ' +
    r.atlas.size.w + 'x' + r.atlas.size.h + ' (' + fill + '% vertical fill) -> ' +
    path.relative(process.cwd(), path.join(args.out, 'mole-sheet.png')));
  console.log('clips: ' + Object.keys(r.atlas.clips).join(', '));
}

module.exports = { pack: pack, shelfPack: shelfPack, PAD: PAD };

if (require.main === module) main();
