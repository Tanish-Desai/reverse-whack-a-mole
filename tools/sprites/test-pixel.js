/* ============================================================
   End-to-end check of the pixel asset set.

   The important properties here are the ones that make the set a
   *set*: every asset draws only from the shared palette, nothing
   is anti-aliased, and the pixel grid survives upscaling intact.

     node tools/sprites/test-pixel.js
   ============================================================ */
'use strict';

var { createCanvas, loadImage } = require('@napi-rs/canvas');
var { Buf, T } = require('./pixel/raster.js');
var PAL = require('./pixel/palette.js');
var MOLE = require('./pixel/mole.js');
var HOLES = require('./pixel/holes.js');
var HAMMER = require('./pixel/hammer.js');
var GRASS = require('./pixel/grass.js');
var SCENE = require('./pixel/scene.js');
var { bufToCanvas } = require('./pixel/png.js');
var { renderMoleFrames, packMoleSheet, staticAssets, SCALE } = require('./build-pixel.js');
var { buildPixelFrames, CLIPS } = require('./pixel/clips.js');

var pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (detail ? '  -- ' + detail : '')); }
}
function section(t) { console.log('\n' + t); }

var PAL_SET = new Set(PAL.RGB.map(function (c) { return c[0] + ',' + c[1] + ',' + c[2]; }));

/* Every visible pixel must be fully opaque and exactly a palette
   colour. Any blend or soft edge shows up here. */
function auditCanvas(cv) {
  var ctx = cv.getContext('2d');
  var d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  var offPalette = 0, partialAlpha = 0;
  for (var i = 0; i < d.length; i += 4) {
    var a = d[i + 3];
    if (a === 0) continue;
    if (a !== 255) { partialAlpha++; continue; }
    if (!PAL_SET.has(d[i] + ',' + d[i + 1] + ',' + d[i + 2])) offPalette++;
  }
  return { offPalette: offPalette, partialAlpha: partialAlpha };
}

/* At an integer zoom every NxN block must be one flat colour. */
function gridIntact(cv, n) {
  var ctx = cv.getContext('2d');
  var d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  var W = cv.width;
  for (var by = 0; by + n <= cv.height; by += n) {
    for (var bx = 0; bx + n <= W; bx += n) {
      var o = (by * W + bx) * 4;
      var r = d[o], g = d[o + 1], b = d[o + 2], a = d[o + 3];
      for (var j = 0; j < n; j++) {
        for (var i = 0; i < n; i++) {
          var p = ((by + j) * W + (bx + i)) * 4;
          if (d[p] !== r || d[p + 1] !== g || d[p + 2] !== b || d[p + 3] !== a) return false;
        }
      }
    }
  }
  return true;
}

/* --- palette discipline ------------------------------------------- */
section('palette discipline');
var assets = staticAssets(SCALE).concat([{ name: 'mole', buf: MOLE.drawMole({}) }]);
var dirty = [];
assets.forEach(function (a) {
  var r = auditCanvas(bufToCanvas(a.buf, SCALE));
  if (r.offPalette || r.partialAlpha) dirty.push(a.name + ' (off=' + r.offPalette + ' soft=' + r.partialAlpha + ')');
});
check('every asset uses only palette colours', dirty.length === 0, dirty.join(', '));
check('no anti-aliased edges anywhere', dirty.length === 0);
check('palette is a shared table', PAL.SIZE === PAL.RGB.length && PAL.SIZE > 0, PAL.SIZE + ' colours');

/* --- pixel grid ---------------------------------------------------- */
section('pixel grid');
check('mole survives ' + SCALE + 'x upscale as flat blocks', gridIntact(bufToCanvas(MOLE.drawMole({}), SCALE), SCALE));
check('hole survives ' + SCALE + 'x upscale as flat blocks', gridIntact(bufToCanvas(HOLES.drawHole(), SCALE), SCALE));
check('hammer survives ' + SCALE + 'x upscale as flat blocks', gridIntact(bufToCanvas(HAMMER.drawHammer(), SCALE), SCALE));

/* --- variants are real recolours, not redraws ---------------------- */
section('variant remapping');
function silhouette(b) {
  var s = [];
  for (var i = 0; i < b.d.length; i++) s.push(b.d[i] === T ? 0 : 1);
  return s.join('');
}
var base = MOLE.drawMole({});
var gold = MOLE.drawMole({ variant: 'gold' });
check('gold keeps the base silhouette', silhouette(base) === silhouette(gold));
check('gold actually changes colours', base.d.join(',') !== gold.d.join(','));
var decoy = MOLE.drawMole({ variant: 'decoy' });
check('decoy adds the wind-up key', silhouette(decoy) !== silhouette(base));

/* --- squash + stretch ---------------------------------------------- */
section('squash and stretch');
function bbox(o) { return MOLE.drawMole(o).bounds(); }
var rest = bbox({}), squash = bbox({ sx: 1.3, sy: 0.7 }), stretch = bbox({ sx: 0.85, sy: 1.25 });
check('squash is wider than rest', squash.w > rest.w, squash.w + ' vs ' + rest.w);
check('squash is shorter than rest', squash.h < rest.h, squash.h + ' vs ' + rest.h);
check('stretch is taller than rest', stretch.h > rest.h, stretch.h + ' vs ' + rest.h);
check('stretch is narrower than rest', stretch.w < rest.w, stretch.w + ' vs ' + rest.w);

/* --- hole occlusion ------------------------------------------------ */
section('hole occlusion');
var m = MOLE.drawMole({});
var sunk = SCENE.clipToHole(m, 100, 100 + 6, 100, 100);
var full = SCENE.clipToHole(m, 100, 100 - 40, 100, 100);
function count(b) { var n = 0; for (var i = 0; i < b.d.length; i++) if (b.d[i] !== T) n++; return n; }
check('a sinking mole is clipped by the rim', count(sunk) < count(m), count(sunk) + ' vs ' + count(m));
check('a risen mole is not clipped', count(full) === count(m), count(full) + ' vs ' + count(m));
check('clipping removes only lower pixels',
  (function () {
    var mb = m.bounds(), sb = sunk.bounds();
    return sb && sb.y === mb.y && sb.y + sb.h <= mb.y + mb.h;
  })());

/* --- every frame must actually differ from its neighbours -------- */
section('frames are distinct');
var byClip = {};
buildPixelFrames().forEach(function (f) {
  (byClip[f.variant + '.' + f.clip] = byClip[f.variant + '.' + f.clip] || []).push(f);
});
var dupes = [];
Object.keys(byClip).forEach(function (k) {
  var seen = {};
  byClip[k].forEach(function (f) {
    /* fingerprint includes the vertical offset, so a 1px bob counts
       as a distinct frame even though the pixels match */
    var sig = MOLE.drawMole(f.opts).d.join(',') + '|' + f.dy + '|' + f.rise.toFixed(3);
    if (seen[sig]) dupes.push(k + ' ' + seen[sig] + '==' + f.index);
    seen[sig] = f.index;
  });
});
check('no duplicate frames inside a clip', dupes.length === 0, dupes.slice(0, 5).join(', '));
check('dazed stars actually rotate',
  MOLE.drawMole({ expr: 'dazed', t: 0 }).d.join(',') !== MOLE.drawMole({ expr: 'dazed', t: 2 }).d.join(','));
check('idle bob is a whole-pixel offset, not a scale',
  (function () {
    var f = buildPixelFrames(['base']).filter(function (x) { return x.clip === 'idle'; });
    return f.some(function (x) { return x.dy !== 0; }) && f.every(function (x) { return x.opts.sy === 1; });
  })());

/* --- determinism ---------------------------------------------------- */
section('determinism');
check('grass regenerates identically',
  GRASS.drawGrass(80, 60).d.join(',') === GRASS.drawGrass(80, 60).d.join(','));
check('hole regenerates identically',
  HOLES.drawHole().d.join(',') === HOLES.drawHole().d.join(','));

/* --- packing -------------------------------------------------------- */
section('spritesheet packing');
var frames = renderMoleFrames(SCALE);
var packed = packMoleSheet(frames, 1024);
var atlas = packed.atlas;
var names = Object.keys(atlas.frames);
check('atlas holds every frame', names.length === frames.length, names.length + ' vs ' + frames.length);
check('sheet is power-of-two',
  (atlas.size.w & (atlas.size.w - 1)) === 0 && (atlas.size.h & (atlas.size.h - 1)) === 0,
  atlas.size.w + 'x' + atlas.size.h);
check('atlas carries hole-mouth geometry',
  atlas.holeMouth && atlas.holeMouth.rx === HOLES.VOID_RX * SCALE);

var overlap = null;
var rects = names.map(function (n) { var r = atlas.frames[n]; return { n: n, r: r }; });
for (var i = 0; i < rects.length && !overlap; i++) {
  for (var j = i + 1; j < rects.length; j++) {
    var a = rects[i].r, b = rects[j].r;
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
      overlap = rects[i].n + ' / ' + rects[j].n; break;
    }
  }
}
check('no two frames overlap', !overlap, overlap);

loadImage(packed.buffer).then(function (img) {
  var sc = createCanvas(atlas.size.w, atlas.size.h);
  var sctx = sc.getContext('2d');
  sctx.drawImage(img, 0, 0);

  var bad = [];
  frames.forEach(function (f) {
    var r = atlas.frames[f.name];
    var fromSheet = Buffer.from(sctx.getImageData(r.x, r.y, r.w, r.h).data);
    var src = Buffer.from(f.canvas.getContext('2d').getImageData(0, 0, f.w, f.h).data);
    if (!fromSheet.equals(src)) bad.push(f.name);
  });
  check('every frame survives packing byte-for-byte', bad.length === 0,
    bad.slice(0, 4).join(', ') + (bad.length > 4 ? ' (+' + (bad.length - 4) + ')' : ''));

  var sheetAudit = auditCanvas(sc);
  check('packed sheet stays on-palette and hard-edged',
    sheetAudit.offPalette === 0 && sheetAudit.partialAlpha === 0,
    'off=' + sheetAudit.offPalette + ' soft=' + sheetAudit.partialAlpha);

  section(fail === 0 ? 'PASS — ' + pass + ' checks' : 'FAIL — ' + fail + ' of ' + (pass + fail) + ' checks failed');
  process.exit(fail === 0 ? 0 : 1);
}).catch(function (e) { console.error(e.stack); process.exit(1); });
