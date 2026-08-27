/* Indexed Buf -> @napi-rs/canvas image, at an integer zoom.
   Upscaling happens in the buffer (see Buf.scaled) so no canvas
   filtering can ever soften a pixel edge. */
'use strict';
var { createCanvas } = require('@napi-rs/canvas');

function bufToCanvas(buf, scale) {
  var b = scale && scale > 1 ? buf.scaled(scale) : buf;
  var cv = createCanvas(b.w, b.h);
  var ctx = cv.getContext('2d');
  var img = ctx.createImageData(b.w, b.h);
  var rgba = b.toRGBA();
  rgba.copy(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length));
  ctx.putImageData(img, 0, 0);
  return cv;
}
function toPNG(buf, scale) { return bufToCanvas(buf, scale).toBuffer('image/png'); }

module.exports = { bufToCanvas: bufToCanvas, toPNG: toPNG };
