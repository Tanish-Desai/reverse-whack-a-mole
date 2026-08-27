/* ============================================================
   Builds the full pixel asset set: a packed mole spritesheet with
   a JSON atlas, plus the static scenery sprites.

     node tools/sprites/build-pixel.js [--scale N] [--out DIR]
   ============================================================ */
'use strict';

var fs = require('fs');
var path = require('path');
var { Buf } = require('./pixel/raster.js');
var { toPNG, bufToCanvas } = require('./pixel/png.js');
var PAL = require('./pixel/palette.js');
var MOLE = require('./pixel/mole.js');
var HOLES = require('./pixel/holes.js');
var HAMMER = require('./pixel/hammer.js');
var GRASS = require('./pixel/grass.js');
var { buildPixelFrames } = require('./pixel/clips.js');
var { shelfPack, PAD } = require('./pack-sheet.js');

var SCALE = 3;
var VW = 1280, VH = 720;

function parseArgs(argv) {
  var a = { scale: SCALE, out: path.join(__dirname, '../../assets/sprites') };
  for (var i = 2; i < argv.length; i++) {
    if (argv[i] === '--scale') a.scale = Number(argv[++i]);
    else if (argv[i] === '--out') a.out = path.resolve(argv[++i]);
  }
  if (!(a.scale >= 1)) throw new Error('--scale must be >= 1');
  return a;
}

/* Render every mole frame as a trimmed pixel buffer, carrying the
   offset from the hole-centre anchor. */
function renderMoleFrames(scale) {
  return buildPixelFrames().map(function (f) {
    var raw = MOLE.drawMole(f.opts);
    var box = raw.bounds();
    if (!box) throw new Error('frame "' + f.name + '" is empty');
    if (box.x === 0 || box.y === 0 || box.x + box.w === raw.w || box.y + box.h === raw.h) {
      throw new Error('frame "' + f.name + '" touches the buffer edge — enlarge MOLE.W/H');
    }
    var trimmed = raw.crop(box);

    /* The game's rise mapping, converted to logical pixels. */
    var riseOffset = (34 - 76 * f.rise) / scale + f.dy;
    var offX = (box.x - MOLE.CX) * scale;
    var offY = (box.y - MOLE.CY + riseOffset) * scale;

    return {
      name: f.name, variant: f.variant, clip: f.clip, index: f.index,
      w: trimmed.w * scale, h: trimmed.h * scale,
      offsetX: Math.round(offX), offsetY: Math.round(offY),
      buf: trimmed,
      canvas: bufToCanvas(trimmed, scale)
    };
  });
}

function pot(n) { var p = 1; while (p < n) p *= 2; return p; }

function packMoleSheet(frames, sheetW) {
  var r = shelfPack(frames, sheetW);
  var sheetH = pot(r.height);
  var { createCanvas } = require('@napi-rs/canvas');
  var sheet = createCanvas(sheetW, sheetH);
  var ctx = sheet.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  var atlas = {
    image: 'mole-sheet.png',
    size: { w: sheetW, h: sheetH },
    scale: SCALE,
    padding: PAD,
    /* Hole mouth geometry, in rendered pixels. The game clips the
       mole to this ellipse so a sinking mole is occluded by the rim
       instead of hanging out below it. */
    holeMouth: { rx: HOLES.VOID_RX * SCALE, ry: HOLES.VOID_RY * SCALE },
    frames: {}, clips: {}
  };

  r.placed.forEach(function (p) {
    var f = p.frame;
    ctx.drawImage(f.canvas, p.x, p.y);
    atlas.frames[f.name] = { x: p.x, y: p.y, w: f.w, h: f.h, offsetX: f.offsetX, offsetY: f.offsetY };
  });

  frames.forEach(function (f) {
    var k = f.variant + '.' + f.clip;
    (atlas.clips[k] = atlas.clips[k] || []).push({ n: f.name, i: f.index });
  });
  Object.keys(atlas.clips).forEach(function (k) {
    atlas.clips[k] = atlas.clips[k].sort(function (a, b) { return a.i - b.i; }).map(function (e) { return e.n; });
  });

  return { atlas: atlas, buffer: sheet.toBuffer('image/png'), usedHeight: r.height };
}

function staticAssets(scale) {
  return [
    { name: 'hole',          buf: HOLES.drawHole(),        ax: HOLES.CX,  ay: HOLES.CY },
    { name: 'hole-front',    buf: HOLES.drawHoleFront(),   ax: HOLES.CX,  ay: HOLES.CY },
    { name: 'hole-boarded',  buf: HOLES.drawHoleBoarded(), ax: HOLES.CX,  ay: HOLES.CY },
    { name: 'hammer',        buf: HAMMER.drawHammer(),     ax: HAMMER.CX, ay: HAMMER.HEAD_Y },
    { name: 'grass',         buf: GRASS.drawGrass(Math.ceil(VW / scale), Math.ceil(VH / scale)), ax: 0, ay: 0 }
  ];
}

function main() {
  var args = parseArgs(process.argv);
  fs.mkdirSync(args.out, { recursive: true });

  var frames = renderMoleFrames(args.scale);
  /* Try a few sheet widths and keep whichever wastes least texture. */
  var packed = [512, 1024, 2048].map(function (w) {
    try { return packMoleSheet(frames, w); } catch (e) { return null; }
  }).filter(Boolean).sort(function (a, b) {
    var area = (a.atlas.size.w * a.atlas.size.h) - (b.atlas.size.w * b.atlas.size.h);
    if (area !== 0) return area;
    /* Same area — prefer the squarer sheet; very tall thin textures
       run into per-dimension limits on some GPUs. */
    return Math.max(a.atlas.size.w, a.atlas.size.h) - Math.max(b.atlas.size.w, b.atlas.size.h);
  })[0];
  fs.writeFileSync(path.join(args.out, 'mole-sheet.png'), packed.buffer);
  fs.writeFileSync(path.join(args.out, 'mole-atlas.json'), JSON.stringify(packed.atlas, null, 2));

  var manifest = { scale: args.scale, palette: PAL.RAMPS, assets: {} };
  staticAssets(args.scale).forEach(function (a) {
    fs.writeFileSync(path.join(args.out, a.name + '.png'), toPNG(a.buf, args.scale));
    manifest.assets[a.name] = {
      file: a.name + '.png',
      w: a.buf.w * args.scale, h: a.buf.h * args.scale,
      anchorX: a.ax * args.scale, anchorY: a.ay * args.scale
    };
  });
  manifest.moleSheet = { image: 'mole-sheet.png', atlas: 'mole-atlas.json', frames: frames.length };
  fs.writeFileSync(path.join(args.out, 'manifest.json'), JSON.stringify(manifest, null, 2));

  var fill = (packed.usedHeight / packed.atlas.size.h * 100).toFixed(1);
  console.log('mole sheet: ' + frames.length + ' frames -> ' + packed.atlas.size.w + 'x' + packed.atlas.size.h + ' (' + fill + '% fill)');
  console.log('static:     ' + Object.keys(manifest.assets).join(', '));
  console.log('palette:    ' + PAL.SIZE + ' colours');
  console.log('out:        ' + path.relative(process.cwd(), args.out));
}

module.exports = { renderMoleFrames: renderMoleFrames, packMoleSheet: packMoleSheet, staticAssets: staticAssets, SCALE: SCALE };

if (require.main === module) main();
