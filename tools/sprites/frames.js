/* ============================================================
   Frame definitions for the mole spritesheet.

   Each clip mirrors a real animation state from drawPlayerMole()
   in js/game.js, sampled into discrete frames. The maths here is
   copied from that function so the rendered sheet matches what
   the game currently draws on screen.
   ============================================================ */
'use strict';

/* Timing constants, mirrored from js/game.js */
var BURROW_TIME = 0.20;
var POP_TIME    = 0.40;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function easeInCubic(t) { return t * t * t; }
function easeOutBack(t) { var c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }

/* Each sampler takes normalised clip progress u (0..1) and returns
   the draw parameters drawMoleAt expects. */
var CLIPS = [
  {
    name: 'idle',
    frames: 8,
    /* bob: sy += sin(bob*4.5)*0.02, sx -= bob*0.5 — one full cycle */
    sample: function (u) {
      var bob = Math.sin(u * Math.PI * 2) * 0.02;
      return { rise: 1, sx: 1 - bob * 0.5, sy: 1 + bob };
    }
  },
  {
    name: 'burrow',
    frames: 6,
    /* dive into the hole; squashes wide and flat on the way down */
    sample: function (u) {
      var rise = 1 - easeInCubic(clamp(u, 0, 1));
      return { rise: rise, sx: 1 + 0.18 * (1 - rise), sy: 1 - 0.2 * (1 - rise) };
    }
  },
  {
    name: 'pop',
    frames: 10,
    /* overshooting pop-up; stretches tall then settles */
    sample: function (u) {
      var e = easeOutBack(clamp(u, 0, 1));
      var k = clamp(u, 0, 1);
      return {
        rise: clamp(e, 0, 1.06),
        sx: 1 - 0.22 * Math.sin(Math.PI * k),
        sy: 1 + 0.26 * Math.sin(Math.PI * k)
      };
    }
  },
  {
    name: 'dazed',
    frames: 8,
    /* stunned, X eyes, orbiting stars driven by the clock */
    sample: function (u) {
      return { rise: 1, sx: 1, sy: 1, dazed: true, t: u * (Math.PI * 2 / 4.2) };
    }
  },
  {
    name: 'squished',
    frames: 1,
    /* game-over pancake */
    sample: function () { return { rise: 0.55, sx: 1.75, sy: 0.3, closedEyes: true }; }
  }
];

/* Palette variants. `gold` is an existing wildcard state. */
var VARIANTS = [
  { name: 'base',  opts: {} },
  { name: 'gold',  opts: { gold: true } }
];

/* Flatten to a render list. Frame names are `variant.clip.NN`. */
function buildFrameList(variantFilter) {
  var out = [];
  VARIANTS.forEach(function (v) {
    if (variantFilter && variantFilter.indexOf(v.name) === -1) return;
    CLIPS.forEach(function (clip) {
      for (var i = 0; i < clip.frames; i++) {
        /* Sample the midpoint of each frame's slice for single-frame
           clips, and across a closed 0..1 span otherwise. */
        var u = clip.frames === 1 ? 0 : i / (clip.frames - 1);
        var params = clip.sample(u);
        var opts = { facing: 1 };
        for (var k in params) if (k !== 'rise') opts[k] = params[k];
        for (var k2 in v.opts) opts[k2] = v.opts[k2];
        out.push({
          name: v.name + '.' + clip.name + '.' + String(i).padStart(2, '0'),
          variant: v.name,
          clip: clip.name,
          index: i,
          rise: params.rise,
          opts: opts
        });
      }
    });
  });
  return out;
}

module.exports = { CLIPS: CLIPS, VARIANTS: VARIANTS, buildFrameList: buildFrameList, BURROW_TIME: BURROW_TIME, POP_TIME: POP_TIME };
