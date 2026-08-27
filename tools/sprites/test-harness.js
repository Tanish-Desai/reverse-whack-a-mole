/* ============================================================
   End-to-end check of the sprite harness.

   Renders every frame, packs a sheet, then verifies the sheet is a
   lossless, non-overlapping, correctly-trimmed representation of
   what js/mole-art.js draws — and that the rise/squash parameters
   actually move the pixels the way the game intends.

     node tools/sprites/test-harness.js
   ============================================================ */
'use strict';

var { createCanvas, loadImage } = require('@napi-rs/canvas');
var MoleArt = require('../../js/mole-art.js');
var { renderFrames, ANCHOR_X, ANCHOR_Y } = require('./render-frames.js');
var { pack, PAD } = require('./pack-sheet.js');
var { buildFrameList } = require('./frames.js');

var pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (detail ? '  -- ' + detail : '')); }
}
function section(t) { console.log('\n' + t); }

/* --- module surface ------------------------------------------------ */
section('mole-art module');
check('exports drawMoleAt', typeof MoleArt.drawMoleAt === 'function');
check('exports drawMoleBody', typeof MoleArt.drawMoleBody === 'function');
check('RISE_TRAVEL matches game (76)', MoleArt.RISE_TRAVEL === 76, 'got ' + MoleArt.RISE_TRAVEL);
check('fur palette matches game.js', MoleArt.FUR.mid === '#8a5c33' && MoleArt.FUR.belly === '#d8b184');

/* --- rendering ----------------------------------------------------- */
section('frame rendering');
var frames = renderFrames({ scale: 1 });
var expected = buildFrameList().length;
check('renders every declared frame', frames.length === expected, frames.length + ' vs ' + expected);
check('all frames have pixels', frames.every(function (f) { return f.w > 0 && f.h > 0; }));

function frameByName(n) {
  var f = frames.filter(function (x) { return x.name === n; })[0];
  if (!f) throw new Error('no frame ' + n);
  return f;
}

/* Trim must be tight: every edge of the bbox holds at least one opaque pixel. */
function isTight(f) {
  var d = f.canvas.getContext('2d').getImageData(0, 0, f.w, f.h).data;
  var a = function (x, y) { return d[(y * f.w + x) * 4 + 3]; };
  var top = false, bot = false, left = false, right = false, x, y;
  for (x = 0; x < f.w; x++) { if (a(x, 0)) top = true; if (a(x, f.h - 1)) bot = true; }
  for (y = 0; y < f.h; y++) { if (a(0, y)) left = true; if (a(f.w - 1, y)) right = true; }
  return top && bot && left && right;
}
check('every frame is tightly trimmed', frames.every(isTight),
  frames.filter(function (f) { return !isTight(f); }).map(function (f) { return f.name; }).join(', '));

/* --- the squash/rise parameters must actually do something --------- */
section('rise + squash behaviour');
var idle = frameByName('base.idle.00');
var burrowEnd = frameByName('base.burrow.05');
var popMid = frameByName('base.pop.04');
var squished = frameByName('base.squished.00');

check('burrow squashes wider than idle', burrowEnd.w > idle.w, burrowEnd.w + ' vs ' + idle.w);
check('burrow squashes shorter than idle', burrowEnd.h < idle.h, burrowEnd.h + ' vs ' + idle.h);
check('pop stretches taller than idle', popMid.h > idle.h, popMid.h + ' vs ' + idle.h);
check('pop stretches narrower than idle', popMid.w < idle.w, popMid.w + ' vs ' + idle.w);
check('squished is the flattest frame', squished.h === Math.min.apply(null, frames.map(function (f) { return f.h; })));
check('squished is wider than tall', squished.w > squished.h * 3, squished.w + 'x' + squished.h);

/* rise drives vertical position: higher rise sits further above the anchor */
var riseLow = frameByName('base.burrow.05').offsetY;   /* rise 0    */
var riseHigh = frameByName('base.burrow.00').offsetY;  /* rise 1    */
check('higher rise offsets further up', riseHigh < riseLow, riseHigh + ' vs ' + riseLow);

/* --- variants must differ ------------------------------------------ */
section('palette variants');
function pixelsOf(f) { return Buffer.from(f.canvas.getContext('2d').getImageData(0, 0, f.w, f.h).data); }
var baseIdle = frameByName('base.idle.00');
var goldIdle = frameByName('gold.idle.00');
check('gold differs from base', !pixelsOf(goldIdle).equals(pixelsOf(baseIdle)) || goldIdle.w !== baseIdle.w);

/* --- determinism --------------------------------------------------- */
section('determinism');
var again = renderFrames({ scale: 1 });
var identical = frames.every(function (f, i) {
  return f.name === again[i].name && f.buffer.equals(again[i].buffer);
});
check('two renders are byte-identical', identical);

/* --- packing ------------------------------------------------------- */
section('spritesheet packing');
var packed = pack({ scale: 1, width: 1024 });
var atlas = packed.atlas;
var names = Object.keys(atlas.frames);

check('atlas holds every frame', names.length === frames.length, names.length + ' vs ' + frames.length);
check('sheet dimensions are powers of two',
  (atlas.size.w & (atlas.size.w - 1)) === 0 && (atlas.size.h & (atlas.size.h - 1)) === 0,
  atlas.size.w + 'x' + atlas.size.h);

var inBounds = names.every(function (n) {
  var r = atlas.frames[n];
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= atlas.size.w && r.y + r.h <= atlas.size.h;
});
check('all rects lie inside the sheet', inBounds);

/* No two frames may overlap, or one would bleed into another. */
var rects = names.map(function (n) { var r = atlas.frames[n]; return { n: n, x: r.x, y: r.y, w: r.w, h: r.h }; });
var overlap = null;
for (var i = 0; i < rects.length && !overlap; i++) {
  for (var j = i + 1; j < rects.length; j++) {
    var a = rects[i], b = rects[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
      overlap = a.n + ' / ' + b.n; break;
    }
  }
}
check('no two frames overlap', !overlap, overlap);

check('clip index covers all clips', Object.keys(atlas.clips).length === 10, Object.keys(atlas.clips).length + ' clips');
check('clips are in playback order', Object.keys(atlas.clips).every(function (k) {
  var seq = atlas.clips[k];
  return seq.every(function (nm, idx) { return Number(nm.split('.').pop()) === idx; });
}));

/* --- the packed sheet must be pixel-identical to the source frames -- */
section('sheet fidelity');
loadImage(packed.buffer).then(function (img) {
  var sc = createCanvas(atlas.size.w, atlas.size.h);
  var sctx = sc.getContext('2d');
  sctx.drawImage(img, 0, 0);

  var mismatched = [];
  frames.forEach(function (f) {
    var r = atlas.frames[f.name];
    if (r.w !== f.w || r.h !== f.h) { mismatched.push(f.name + ' (size)'); return; }
    var fromSheet = Buffer.from(sctx.getImageData(r.x, r.y, r.w, r.h).data);
    if (!fromSheet.equals(pixelsOf(f))) mismatched.push(f.name);
  });
  check('every frame survives packing byte-for-byte', mismatched.length === 0,
    mismatched.slice(0, 5).join(', ') + (mismatched.length > 5 ? ' (+' + (mismatched.length - 5) + ')' : ''));

  /* Anchor round-trip: re-place a frame using its offset and confirm it
     lands where drawMoleAt would have drawn it directly. */
  var probe = frameByName('base.idle.00');
  var direct = createCanvas(300, 380);
  var dctx = direct.getContext('2d');
  MoleArt.drawMoleAt(dctx, ANCHOR_X, ANCHOR_Y, 1,
    Object.assign({}, buildFrameList().filter(function (f) { return f.name === 'base.idle.00'; })[0].opts, { shadow: false }));

  var rebuilt = createCanvas(300, 380);
  var rctx = rebuilt.getContext('2d');
  var pr = atlas.frames[probe.name];
  rctx.drawImage(sc, pr.x, pr.y, pr.w, pr.h,
    ANCHOR_X + probe.offsetX, ANCHOR_Y + probe.offsetY, pr.w, pr.h);

  var da = Buffer.from(dctx.getImageData(0, 0, 300, 380).data);
  var rb = Buffer.from(rctx.getImageData(0, 0, 300, 380).data);
  check('atlas offsets reposition the sprite exactly', da.equals(rb));

  section(fail === 0 ? 'PASS — ' + pass + ' checks' : 'FAIL — ' + fail + ' of ' + (pass + fail) + ' checks failed');
  process.exit(fail === 0 ? 0 : 1);
}).catch(function (e) {
  console.error('\nharness error: ' + e.stack);
  process.exit(1);
});
