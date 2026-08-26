/* ============================================================
   UNHAMMERED — sprite runtime

   Loads the pixel asset set (built by tools/sprites/build-pixel.js)
   and provides the draw helpers game.js uses.

   Loading is asynchronous and non-blocking: the game boots and runs
   on its original procedural art, and swaps to sprites the moment
   they finish loading. If the assets are missing the game still
   plays, just in the old style.
   ============================================================ */
'use strict';

var Sprites = (function () {

var ready = false;
var atlas = null;
var manifest = null;
var sheet = null;
var images = {};
var onReady = [];
var lastError = null;

function loadImage(src) {
  return new Promise(function (res, rej) {
    var im = new Image();
    im.onload = function () { res(im); };
    im.onerror = function () { rej(new Error('failed to load ' + src)); };
    im.src = src;
  });
}

function loadJSON(src) {
  return fetch(src).then(function (r) {
    if (!r.ok) throw new Error(src + ' -> HTTP ' + r.status);
    return r.json();
  });
}

function load(base) {
  base = base || 'assets/sprites/';
  return Promise.all([
    loadJSON(base + 'mole-atlas.json'),
    loadJSON(base + 'manifest.json')
  ]).then(function (r) {
    atlas = r[0];
    manifest = r[1];
    var names = Object.keys(manifest.assets);
    return Promise.all(
      [loadImage(base + atlas.image)].concat(names.map(function (n) {
        return loadImage(base + manifest.assets[n].file).then(function (im) { images[n] = im; });
      }))
    );
  }).then(function (r) {
    sheet = r[0];
    ready = true;
    onReady.forEach(function (fn) { fn(); });
    onReady.length = 0;
    return true;
  }).catch(function (e) {
    /* Not fatal — the game keeps its procedural look. The reason is
       kept on the module so a failed load can be diagnosed. */
    lastError = e;
    if (window.console) console.warn('[sprites] ' + e.message + ' — falling back to procedural art');
    return false;
  });
}

/* Pick a frame name from a clip by normalised progress (0..1).
   Kept pure so the selection logic can be tested on its own. */
function pickFrame(clipList, u) {
  if (!clipList || !clipList.length) return null;
  var i = Math.floor(u * clipList.length);
  if (i < 0) i = 0;
  if (i >= clipList.length) i = clipList.length - 1;
  return clipList[i];
}

/* Same, but wrapping — for looping clips like idle and dazed. */
function loopFrame(clipList, u) {
  if (!clipList || !clipList.length) return null;
  var i = Math.floor(u * clipList.length) % clipList.length;
  if (i < 0) i += clipList.length;
  return clipList[i];
}

function clipOf(variant, clip) {
  return atlas && atlas.clips[variant + '.' + clip];
}

/* Draw one mole frame. (hx, hy) is the hole centre; the atlas offsets
   already contain the frame's rise, so this is the only anchor needed. */
function drawMoleFrame(ctx, name, hx, hy) {
  if (!ready || !name) return false;
  var f = atlas.frames[name];
  if (!f) return false;
  ctx.drawImage(sheet, f.x, f.y, f.w, f.h,
    Math.round(hx + f.offsetX), Math.round(hy + f.offsetY), f.w, f.h);
  return true;
}

/* Draw a static asset at its own anchor point. */
function drawAsset(ctx, name, x, y) {
  if (!ready) return false;
  var a = manifest.assets[name];
  var im = images[name];
  if (!a || !im) return false;
  ctx.drawImage(im, Math.round(x - a.anchorX), Math.round(y - a.anchorY));
  return true;
}

/* Clip to everything above the hole mouth's front arc, so a mole
   sinking into the burrow is occluded by the near rim instead of
   hanging out below it. */
function clipHoleMouth(ctx, x, y) {
  if (!ready) return;
  var m = atlas.holeMouth;
  var R = 4000;
  ctx.beginPath();
  ctx.ellipse(x, y, m.rx, m.ry, 0, 0, Math.PI, false);
  ctx.lineTo(x - R, y);
  ctx.lineTo(x - R, y - R);
  ctx.lineTo(x + R, y - R);
  ctx.lineTo(x + R, y);
  ctx.closePath();
  ctx.clip();
}

return {
  load: load,
  get ready() { return ready; },
  get atlas() { return atlas; },
  get manifest() { return manifest; },
  whenReady: function (fn) { ready ? fn() : onReady.push(fn); },
  clipOf: clipOf,
  pickFrame: pickFrame,
  loopFrame: loopFrame,
  drawMoleFrame: drawMoleFrame,
  drawAsset: drawAsset,
  clipHoleMouth: clipHoleMouth,
  assetSize: function (n) { return manifest && manifest.assets[n]; },
  get lastError() { return lastError; }
};

})();

if (typeof module === 'object' && module.exports) module.exports = Sprites;
