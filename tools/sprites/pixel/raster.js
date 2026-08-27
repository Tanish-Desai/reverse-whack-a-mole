/* ============================================================
   Indexed pixel buffer + integer-only drawing primitives.

   Everything works on a low-resolution logical grid where one
   cell is one art pixel. Nothing here uses canvas transforms or
   anti-aliasing, so edges stay hard and the pixel grid is never
   broken by fractional scaling.

   -1 means transparent.
   ============================================================ */
'use strict';

var PAL = require('./palette.js');

var T = -1;   /* transparent */

function Buf(w, h) {
  this.w = w; this.h = h;
  this.d = new Int16Array(w * h).fill(T);
}

Buf.prototype.inside = function (x, y) {
  return x >= 0 && y >= 0 && x < this.w && y < this.h;
};
Buf.prototype.get = function (x, y) {
  return this.inside(x, y) ? this.d[y * this.w + x] : T;
};
Buf.prototype.set = function (x, y, c) {
  if (this.inside(x, y) && c !== T) this.d[y * this.w + x] = c;
  return this;
};
/* set without the transparent guard — used to punch holes */
Buf.prototype.poke = function (x, y, c) {
  if (this.inside(x, y)) this.d[y * this.w + x] = c;
  return this;
};

Buf.prototype.rect = function (x, y, w, h, c) {
  for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.set(x + i, y + j, c);
  return this;
};
Buf.prototype.hline = function (x, y, len, c) { return this.rect(x, y, len, 1, c); };
Buf.prototype.vline = function (x, y, len, c) { return this.rect(x, y, 1, len, c); };

/* Solid ellipse, symmetric on the integer grid. Row half-widths come
   from the ellipse equation and are rounded once, so the silhouette
   is stable as rx/ry change by a single pixel (which is what makes
   squash-and-stretch animate cleanly). */
Buf.prototype.ellipse = function (cx, cy, rx, ry, c) {
  if (rx < 0.5 || ry < 0.5) return this;
  for (var dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
    var k = 1 - (dy * dy) / (ry * ry);
    if (k < 0) continue;
    var half = Math.round(rx * Math.sqrt(k));
    for (var dx = -half; dx <= half; dx++) this.set(cx + dx, cy + dy, c);
  }
  return this;
};
Buf.prototype.circle = function (cx, cy, r, c) { return this.ellipse(cx, cy, r, r, c); };

/* Upper or lower half of an ellipse — used for hole mouths and rims. */
Buf.prototype.halfEllipse = function (cx, cy, rx, ry, c, which) {
  for (var dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
    if (which === 'top' && dy > 0) continue;
    if (which === 'bottom' && dy < 0) continue;
    var k = 1 - (dy * dy) / (ry * ry);
    if (k < 0) continue;
    var half = Math.round(rx * Math.sqrt(k));
    for (var dx = -half; dx <= half; dx++) this.set(cx + dx, cy + dy, c);
  }
  return this;
};

Buf.prototype.line = function (x0, y0, x1, y1, c) {
  var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  var err = dx - dy;
  for (;;) {
    this.set(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    var e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return this;
};

/* Recolour every pixel of one index. */
Buf.prototype.replace = function (from, to) {
  for (var i = 0; i < this.d.length; i++) if (this.d[i] === from) this.d[i] = to;
  return this;
};

/* Wrap the opaque silhouette in an outline. 4-connected by default;
   8-connected closes diagonal staircases on rounded shapes. */
Buf.prototype.outline = function (c, diagonal) {
  var out = [];
  var n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var n8 = n4.concat([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
  var nb = diagonal ? n8 : n4;
  for (var y = 0; y < this.h; y++) {
    for (var x = 0; x < this.w; x++) {
      if (this.get(x, y) !== T) continue;
      for (var i = 0; i < nb.length; i++) {
        var v = this.get(x + nb[i][0], y + nb[i][1]);
        if (v !== T && v !== c) { out.push(y * this.w + x); break; }
      }
    }
  }
  for (var k = 0; k < out.length; k++) this.d[out[k]] = c;
  return this;
};

/* Composite another buffer on top at (ox, oy). */
Buf.prototype.blit = function (src, ox, oy) {
  for (var y = 0; y < src.h; y++) {
    for (var x = 0; x < src.w; x++) {
      var v = src.get(x, y);
      if (v !== T) this.set(x + ox, y + oy, v);
    }
  }
  return this;
};

/* Tight bounding box of opaque pixels, or null. */
Buf.prototype.bounds = function () {
  var minX = this.w, minY = this.h, maxX = -1, maxY = -1;
  for (var y = 0; y < this.h; y++) {
    for (var x = 0; x < this.w; x++) {
      if (this.d[y * this.w + x] !== T) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
};

Buf.prototype.crop = function (b) {
  var out = new Buf(b.w, b.h);
  for (var y = 0; y < b.h; y++) for (var x = 0; x < b.w; x++) out.poke(x, y, this.get(b.x + x, b.y + y));
  return out;
};

/* Indexed -> RGBA bytes, at 1 logical pixel per output pixel. */
Buf.prototype.toRGBA = function () {
  var out = Buffer.alloc(this.w * this.h * 4);
  for (var i = 0; i < this.d.length; i++) {
    var v = this.d[i];
    if (v === T) continue;
    var rgb = PAL.RGB[v];
    out[i * 4] = rgb[0]; out[i * 4 + 1] = rgb[1]; out[i * 4 + 2] = rgb[2]; out[i * 4 + 3] = 255;
  }
  return out;
};

/* Nearest-neighbour upscale, done by hand so no canvas filtering
   can soften the edges regardless of backend defaults. */
Buf.prototype.scaled = function (n) {
  var out = new Buf(this.w * n, this.h * n);
  for (var y = 0; y < this.h; y++) {
    for (var x = 0; x < this.w; x++) {
      var v = this.get(x, y);
      if (v === T) continue;
      for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) out.poke(x * n + i, y * n + j, v);
    }
  }
  return out;
};

module.exports = { Buf: Buf, T: T };
