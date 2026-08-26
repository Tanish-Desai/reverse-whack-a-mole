/* ============================================================
   Animation clips for the pixel mole.

   These are deliberately NOT the vector harness's clip table.
   Pixel art animates in whole pixels: a 2% scale bob rounds to
   no change at all at this resolution, so the idle is a 1px
   vertical offset instead. Frame counts are tuned so no two
   frames in a clip come out identical.
   ============================================================ */
'use strict';

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function easeInCubic(t) { return t * t * t; }
function easeOutBack(t) { var c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }

var CLIPS = [
  {
    name: 'idle',
    frames: 4,
    /* whole-sprite 1px bob — the pixel-art idiom for breathing */
    sample: function (u, i) {
      return { rise: 1, sx: 1, sy: 1, dy: [0, -1, 0, 1][i] };
    }
  },
  {
    name: 'burrow',
    frames: 6,
    sample: function (u) {
      var rise = 1 - easeInCubic(clamp(u, 0, 1));
      return { rise: rise, sx: 1 + 0.20 * (1 - rise), sy: 1 - 0.22 * (1 - rise) };
    }
  },
  {
    name: 'pop',
    frames: 8,
    sample: function (u) {
      var e = easeOutBack(clamp(u, 0, 1));
      var k = clamp(u, 0, 1);
      return {
        rise: clamp(e, 0, 1.15),
        sx: 1 - 0.24 * Math.sin(Math.PI * k),
        sy: 1 + 0.28 * Math.sin(Math.PI * k)
      };
    }
  },
  {
    name: 'dazed',
    frames: 6,
    /* stars orbit a full turn across the clip */
    sample: function (u, i, n) {
      return { rise: 1, sx: 1, sy: 1, dazed: true, t: (i / n) * (Math.PI * 2 / 3) };
    }
  },
  {
    name: 'squished',
    frames: 1,
    sample: function () { return { rise: 0.55, sx: 1.7, sy: 0.32, closedEyes: true }; }
  }
];

var VARIANTS = ['base', 'gold', 'decoy'];

function buildPixelFrames(variantFilter) {
  var out = [];
  VARIANTS.forEach(function (v) {
    if (variantFilter && variantFilter.indexOf(v) === -1) return;
    CLIPS.forEach(function (clip) {
      for (var i = 0; i < clip.frames; i++) {
        var u = clip.frames === 1 ? 0 : i / (clip.frames - 1);
        var p = clip.sample(u, i, clip.frames);
        out.push({
          name: v + '.' + clip.name + '.' + String(i).padStart(2, '0'),
          variant: v, clip: clip.name, index: i,
          rise: p.rise, dy: p.dy || 0,
          opts: {
            sx: p.sx, sy: p.sy, variant: v, facing: 1, t: p.t || 0,
            expr: p.dazed ? 'dazed' : (p.closedEyes ? 'closed' : 'normal')
          }
        });
      }
    });
  });
  return out;
}

module.exports = { CLIPS: CLIPS, VARIANTS: VARIANTS, buildPixelFrames: buildPixelFrames };
