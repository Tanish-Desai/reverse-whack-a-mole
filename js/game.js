/* ============================================================
   UNHAMMERED — Reverse Whack-a-Mole
   Vanilla JS + Canvas. No dependencies.
   ============================================================ */
'use strict';

(function () {

/* ------------------------------------------------------------
   1. Constants
   ------------------------------------------------------------ */

var VW = 1280, VH = 720;                 /* virtual (design) resolution */
var COLS = 4, ROWS = 3, NCELLS = COLS * ROWS;
var HOLE_RX = 66, HOLE_RY = 31;
var SPACING_X = 232, SPACING_Y = 176;
var ARENA_CX = 640, ARENA_CY = 440;

var MOVE_CD_ABOVE = 0.05;                /* just enough to stop same-frame spam */
var MOVE_CD_UNDER = 0.04;
var MOVE_REPEAT   = 0.14;                /* auto-repeat rate while a key is held */
var BURROW_TIME   = 0.20;                /* invulnerable dive */
var UNDER_TIME    = 3.0;                 /* surface timer */
var EJECT_STUN    = 0.40;
var HIT_STUN      = 0.80;
var HIT_INVULN    = 1.5;
var STRIKE_TIME   = 0.30;                /* hammer danger window */
var RECOVER_TIME  = 0.25;
var CLOSE_WINDOW  = 0.5;
var COMBO_WINDOW  = 3.0;
var MILESTONE     = 15;                  /* seconds per survival bonus */
var START_LIVES   = 3, MAX_LIVES = 5;

var FONT = 'Verdana, Geneva, "DejaVu Sans", sans-serif';

/* Difficulty anchors — interpolated continuously between rows. */
var PHASES = [
  { t: 0,  warn: 1.00, minA: 1, maxA: 1, gap: 2.0, w: { random: 80, adjacent: 20, direct: 0,  pattern: 0  }, cluster: 0.00 },
  { t: 15, warn: 0.80, minA: 1, maxA: 2, gap: 1.5, w: { random: 60, adjacent: 30, direct: 10, pattern: 0  }, cluster: 0.25 },
  { t: 30, warn: 0.65, minA: 2, maxA: 3, gap: 1.2, w: { random: 40, adjacent: 30, direct: 20, pattern: 10 }, cluster: 0.40 },
  { t: 45, warn: 0.50, minA: 3, maxA: 4, gap: 0.9, w: { random: 20, adjacent: 30, direct: 30, pattern: 20 }, cluster: 0.50 },
  { t: 60, warn: 0.40, minA: 4, maxA: 5, gap: 0.7, w: { random: 10, adjacent: 20, direct: 40, pattern: 30 }, cluster: 0.60 }
];

var WILDCARDS = [
  { id: 'lockdown',  weight: 25, dur: 5, name: 'GRID LOCKDOWN', blurb: 'Holes boarded up!',        color: '#ff9130', icon: 'lock'  },
  { id: 'extralife', weight: 15, dur: 3, name: 'EXTRA LIFE',    blurb: 'Grab it — above ground!',  color: '#ff5c8a', icon: 'heart' },
  { id: 'frenzy',    weight: 20, dur: 4, name: 'FRENZY MODE',   blurb: 'Triple points. Good luck.',color: '#a45cff', icon: 'bolt' },
  { id: 'decoy',     weight: 15, dur: 4, name: 'DECOY MOLE',    blurb: 'It draws their aim.',      color: '#2fd4d4', icon: 'decoy' },
  { id: 'quake',     weight: 10, dur: 3, name: 'EARTHQUAKE',    blurb: 'The grid rearranges!',     color: '#c08b52', icon: 'quake' },
  { id: 'golden',    weight: 15, dur: 4, name: 'GOLDEN MOLE',   blurb: '5x points. Untouchable.',  color: '#ffd23f', icon: 'star'  }
];

var CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-';

/* ------------------------------------------------------------
   2. Utilities
   ------------------------------------------------------------ */

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rnd(a, b) { return a + Math.random() * (b - a); }
function rndInt(a, b) { return Math.floor(rnd(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInCubic(t) { return t * t * t; }
function easeOutBack(t) { var c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
function shuffled(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function idx(c, r) { return r * COLS + c; }
function cellCol(i) { return i % COLS; }
function cellRow(i) { return Math.floor(i / COLS); }
function fmtTime(s) { return s.toFixed(1) + 's'; }

/* ------------------------------------------------------------
   3. Canvas setup & scaling (letterbox, DPR-aware)
   ------------------------------------------------------------ */

var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d', { alpha: false });
var scaleX = 1, scaleY = 1;

if (!ctx.roundRect) {
  /* tiny fallback for older engines */
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

function resize() {
  var dpr = window.devicePixelRatio || 1;
  var availW = window.innerWidth, availH = window.innerHeight;
  var s = Math.min(availW / VW, availH / VH);
  var cssW = Math.floor(VW * s), cssH = Math.floor(VH * s);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  scaleX = canvas.width / VW;
  scaleY = canvas.height / VH;
  ctx.imageSmoothingEnabled = true;
}
function frameReset() { ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0); }
window.addEventListener('resize', resize);

/* ------------------------------------------------------------
   4. Drawing helpers
   ------------------------------------------------------------ */

function ellipse(x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}
function circle(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}
function setFont(size, weight) {
  ctx.font = (weight || 900) + ' ' + size + 'px ' + FONT;
}
function text(str, x, y, size, fill, opts) {
  opts = opts || {};
  setFont(size, opts.weight);
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = opts.baseline || 'middle';
  if (opts.shadow !== false) {
    ctx.save();
    ctx.globalAlpha = (ctx.globalAlpha) * 0.45;
    ctx.fillStyle = '#000';
    ctx.fillText(str, x + (opts.sh || 3), y + (opts.sh || 3));
    ctx.restore();
  }
  if (opts.outline !== 0) {
    ctx.lineWidth = opts.outline || Math.max(3, size * 0.14);
    ctx.strokeStyle = opts.outlineColor || 'rgba(20,12,6,0.92)';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}
function measure(str, size, weight) {
  setFont(size, weight);
  return ctx.measureText(str).width;
}
function panel(x, y, w, h, r, fill, stroke, lw) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.lineWidth = lw || 4; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function star(x, y, r1, r2, points, rot) {
  ctx.beginPath();
  for (var i = 0; i < points * 2; i++) {
    var a = rot + (i * Math.PI) / points;
    var r = i % 2 ? r2 : r1;
    var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
function heart(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.75);
  ctx.bezierCurveTo(x - s * 1.3, y - s * 0.25, x - s * 0.5, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 1.1, x + s * 1.3, y - s * 0.25, x, y + s * 0.75);
  ctx.closePath();
}

/* ------------------------------------------------------------
   5. Static background (built once into an offscreen canvas)
   ------------------------------------------------------------ */

var bgCanvas = document.createElement('canvas');
bgCanvas.width = VW; bgCanvas.height = VH;

function buildBackground() {
  var g = bgCanvas.getContext('2d');
  var sky = g.createLinearGradient(0, 0, 0, VH);
  sky.addColorStop(0, '#7ec850');
  sky.addColorStop(0.42, '#63b040');
  sky.addColorStop(1, '#3f8330');
  g.fillStyle = sky;
  g.fillRect(0, 0, VW, VH);

  /* broad dirt patch under the arena */
  var dirt = g.createRadialGradient(ARENA_CX, ARENA_CY, 120, ARENA_CX, ARENA_CY, 620);
  dirt.addColorStop(0, 'rgba(120,84,50,0.34)');
  dirt.addColorStop(0.6, 'rgba(120,84,50,0.14)');
  dirt.addColorStop(1, 'rgba(120,84,50,0)');
  g.fillStyle = dirt;
  g.fillRect(0, 0, VW, VH);

  /* soft colour blotches break up the flat green */
  var i, x, y, h, w, shade;
  for (i = 0; i < 90; i++) {
    x = Math.random() * VW;
    y = Math.random() * VH;
    var rr = 60 + Math.random() * 190;
    var blot = g.createRadialGradient(x, y, 0, x, y, rr);
    var tint = Math.random() < 0.5 ? '86,160,58' : '52,116,44';
    blot.addColorStop(0, 'rgba(' + tint + ',0.20)');
    blot.addColorStop(1, 'rgba(' + tint + ',0)');
    g.fillStyle = blot;
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }

  /* grass tufts — small three-blade clusters, denser toward the bottom */
  function blade(bx, by, bh, bw, lean, fill) {
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(bx - bw, by);
    g.quadraticCurveTo(bx + lean * 0.35, by - bh * 0.65, bx + lean, by - bh);
    g.quadraticCurveTo(bx + lean * 0.2, by - bh * 0.6, bx + bw, by);
    g.closePath();
    g.fill();
  }
  for (i = 0; i < 620; i++) {
    x = Math.random() * VW;
    y = 30 + Math.pow(Math.random(), 0.8) * (VH - 30);
    var depth = 0.55 + (y / VH) * 0.75;
    shade = Math.random();
    var col = shade < 0.46 ? 'rgba(44,104,36,0.62)'
            : (shade < 0.84 ? 'rgba(138,200,84,0.5)' : 'rgba(198,232,128,0.34)');
    var blades = 2 + Math.floor(Math.random() * 3);
    for (var b = 0; b < blades; b++) {
      var off = (b - (blades - 1) / 2) * (3.5 + Math.random() * 3);
      h = (9 + Math.random() * 13) * depth;
      w = (2.0 + Math.random() * 1.6) * depth;
      blade(x + off, y, h, w, off * 1.5 + (Math.random() - 0.5) * 7, col);
    }
  }

  /* little flowers for cartoon flavour */
  var petals = ['#fff3b0', '#ffd6e8', '#dff1ff'];
  for (i = 0; i < 34; i++) {
    x = Math.random() * VW;
    y = 150 + Math.random() * (VH - 170);
    var c = petals[i % petals.length];
    for (var p = 0; p < 5; p++) {
      var a = (p / 5) * Math.PI * 2;
      g.fillStyle = c;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5, 3.2, 3.2, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffcf4d';
    g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill();
  }

  /* vignette */
  var vg = g.createRadialGradient(VW / 2, VH / 2, 320, VW / 2, VH / 2, 820);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(12,30,10,0.42)');
  g.fillStyle = vg;
  g.fillRect(0, 0, VW, VH);
}

/* ------------------------------------------------------------
   6. Game state
   ------------------------------------------------------------ */

var S = {
  TITLE: 'TITLE', TUTORIAL: 'TUTORIAL', PLAYING: 'PLAYING',
  PAUSED: 'PAUSED', GAME_OVER: 'GAME_OVER'
};

var state = S.TITLE;
var T = 0;                  /* monotonic animation clock (seconds) */
var elapsed = 0;            /* survival time of the current run */
var autopilot = false;      /* attract-mode AI drives the mole */

var basePos = [];           /* canonical hole positions */
var holePos = [];           /* current (animated) hole positions */
var holeTarget = [];        /* where each hole is heading */
var blocked = [];           /* seconds of lockdown remaining per cell */
var vulnLeft = [];          /* T at which the mole stopped being vulnerable on a cell */

var mole, hammers, particles, floaters, banners;
var lives, score, scoreF, displayScore, highScore, newHigh;
var comboTier, comboTimer, nextMilestone;
var spawnTimer, wildTimer, wild, decoy, pickup;
var frenzy, golden, quake;
var shakeMag, shakeTime, shakeDur, flashRed, edgeFlash, dimAmount;
var stats, firstPlayHintTimer;
var gameOverT, gameOverPhase, countUp, initials, initialSlot, myRank;
var firstSession = false;   /* set at boot — drives the one-time controls hint */

/* ---- slow motion ----
   Dramatic beats (getting bonked, a wildcard announcement) drop the simulation
   to a fraction of real speed and ease back. The UI clock and the banners stay
   on real time so an announcement never outstays its welcome. */
var timeScale = 1;
var slowT = 0, slowDur = 0, slowMin = 1;

function slowMo(min, dur) {
  var remaining = slowDur - slowT;
  if (min <= slowMin || remaining <= 0) {
    slowMin = min; slowT = 0; slowDur = dur;
    timeScale = min;          /* bite on the trigger frame, not the next one */
  }
}
function updateSlowMo(dt) {
  if (slowT >= slowDur) { timeScale = 1; slowMin = 1; return; }
  slowT += dt;
  var k = clamp(slowT / slowDur, 0, 1);
  /* hold the slowdown, then ease back up to full speed */
  timeScale = k < 0.32 ? slowMin : lerp(slowMin, 1, easeOutCubic((k - 0.32) / 0.68));
}
var tutorialStep, tutorialT, tutorialReturn;
var menuIndex = 0;          /* 0 = start, 1 = how to play */
var confetti;

function buildGrid() {
  basePos.length = 0;
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      basePos.push({
        x: ARENA_CX + (c - (COLS - 1) / 2) * SPACING_X,
        y: ARENA_CY + (r - (ROWS - 1) / 2) * SPACING_Y
      });
    }
  }
  holePos = basePos.map(function (p) { return { x: p.x, y: p.y }; });
  holeTarget = basePos.map(function (p) { return { x: p.x, y: p.y }; });
}

function pos(i) { return holePos[i]; }

function resetRun() {
  elapsed = 0;
  mole = {
    col: 1, row: 1, state: 'above', tState: 0,
    under: UNDER_TIME, moveCd: 0, stun: 0, invuln: 0, dazed: 0,
    popAnim: 0, squashY: 1, squashX: 1, bob: Math.random() * 10,
    squished: 0, ejectFlash: 0, facing: 1
  };
  hammers = [];
  particles = [];
  floaters = [];
  banners = [];
  confetti = [];
  lives = START_LIVES;
  score = 0; scoreF = 0; displayScore = 0;
  highScore = Store.highScore();
  newHigh = false;
  comboTier = 0; comboTimer = 0;
  nextMilestone = MILESTONE;
  spawnTimer = 1.1;
  wildTimer = rnd(12, 20);
  wild = null; decoy = null; pickup = null;
  frenzy = 0; golden = 0; quake = 0;
  shakeMag = 0; shakeTime = 0; shakeDur = 1;
  timeScale = 1; slowT = 0; slowDur = 0; slowMin = 1;
  clearHeld();
  flashRed = 0; edgeFlash = 0; dimAmount = 0;
  stats = { strikes: 0, dodged: 0, closeCalls: 0, longestCombo: 0, hits: 0 };
  firstPlayHintTimer = firstSession ? 9 : 0;
  for (var i = 0; i < NCELLS; i++) { blocked[i] = 0; vulnLeft[i] = -999; }
  for (i = 0; i < NCELLS; i++) { holeTarget[i] = { x: basePos[i].x, y: basePos[i].y }; }
}

function moleCell() { return idx(mole.col, mole.row); }
function moleVulnerable() {
  return mole.state === 'above' && mole.invuln <= 0 && golden <= 0;
}

/* ------------------------------------------------------------
   7. Effects: particles, floating text, shake, banners
   ------------------------------------------------------------ */

function spawnParticle(p) { if (particles.length < 460) particles.push(p); }

function dustPuff(x, y, n, opts) {
  opts = opts || {};
  var spread = opts.spread || 1;
  for (var i = 0; i < n; i++) {
    var a = rnd(0, Math.PI * 2);
    var sp = rnd(30, 150) * spread;
    spawnParticle({
      type: 'dust', x: x + rnd(-14, 14), y: y + rnd(-6, 6),
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.45 - rnd(20, 90) * spread,
      life: 0, max: rnd(0.35, 0.75), size: rnd(6, 17) * (opts.size || 1),
      grav: 210, color: opts.color || (Math.random() < 0.5 ? '#a9784b' : '#7d5836')
    });
  }
}

function starBurst(x, y, n, color) {
  for (var i = 0; i < n; i++) {
    var a = rnd(0, Math.PI * 2);
    var sp = rnd(90, 300);
    spawnParticle({
      type: 'star', x: x, y: y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90,
      life: 0, max: rnd(0.5, 1.0), size: rnd(6, 13),
      grav: 300, rot: rnd(0, 6), vr: rnd(-9, 9), color: color || '#ffe066'
    });
  }
}

function sparkle(x, y, color) {
  spawnParticle({
    type: 'spark', x: x, y: y, vx: rnd(-30, 30), vy: rnd(-70, -20),
    life: 0, max: rnd(0.3, 0.7), size: rnd(2.5, 6), grav: 40, color: color
  });
}

function shockwave(x, y, color) {
  spawnParticle({
    type: 'ring', x: x, y: y, vx: 0, vy: 0, life: 0, max: 0.36,
    size: 18, grav: 0, color: color || 'rgba(255,255,255,0.9)'
  });
}

function popConfetti(n) {
  for (var i = 0; i < n; i++) {
    confetti.push({
      x: rnd(0, VW), y: rnd(-260, -10),
      vx: rnd(-60, 60), vy: rnd(90, 260),
      w: rnd(7, 15), h: rnd(9, 20), rot: rnd(0, 6), vr: rnd(-7, 7),
      color: pick(['#ff5c8a', '#ffd23f', '#5ce1e6', '#a45cff', '#7ed957', '#ff9130'])
    });
  }
}

function floatText(str, x, y, color, size, opts) {
  opts = opts || {};
  floaters.push({
    text: str, x: x, y: y, color: color, size: size || 30,
    life: 0, max: opts.max || 1.1, vy: opts.vy || -62, pop: opts.pop || 0.16
  });
}

function shake(mag, dur) {
  if (mag >= shakeMag * (1 - shakeTime / Math.max(0.001, shakeDur)) || shakeTime >= shakeDur) {
    shakeMag = mag; shakeTime = 0; shakeDur = dur;
  }
}

function banner(title, blurb, color) {
  banners.push({ title: title, blurb: blurb, color: color, life: 0, max: 2.0 });
}

function updateEffects(dt) {
  var i, p;
  for (i = particles.length - 1; i >= 0; i--) {
    p = particles[i];
    p.life += dt;
    if (p.life >= p.max) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.grav * dt;
    p.vx *= (1 - 1.6 * dt);
    if (p.vr) p.rot += p.vr * dt;
  }
  for (i = floaters.length - 1; i >= 0; i--) {
    p = floaters[i];
    p.life += dt;
    if (p.life >= p.max) { floaters.splice(i, 1); continue; }
    p.y += p.vy * dt;
    p.vy *= (1 - 1.2 * dt);
  }
  for (i = confetti.length - 1; i >= 0; i--) {
    p = confetti[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 120 * dt; p.rot += p.vr * dt;
    if (p.y > VH + 60) confetti.splice(i, 1);
  }
  if (shakeTime < shakeDur) shakeTime += dt;
  if (flashRed > 0) flashRed = Math.max(0, flashRed - dt * 2.2);
  if (edgeFlash > 0) edgeFlash = Math.max(0, edgeFlash - dt * 3.4);
}

/* Banners run on the real clock so slow motion doesn't stretch them out. */
function updateBanners(dt) {
  for (var i = banners.length - 1; i >= 0; i--) {
    banners[i].life += dt;
    if (banners[i].life >= banners[i].max) banners.splice(i, 1);
  }
}

function shakeOffset() {
  if (shakeTime >= shakeDur) return { x: 0, y: 0 };
  var k = 1 - shakeTime / shakeDur;
  var m = shakeMag * k * k;
  return { x: (Math.random() * 2 - 1) * m, y: (Math.random() * 2 - 1) * m };
}

/* ------------------------------------------------------------
   8. Difficulty curve (continuous interpolation between anchors)
   ------------------------------------------------------------ */

/* The spec gives a table of time bands AND asks for continuous scaling, so each
   band holds its tabulated values through its first half and then eases into the
   next band's values across the second half — no visible step changes, and every
   number in the table is what you actually get for most of that band. */
function difficulty() {
  var t = elapsed;
  var last = PHASES[PHASES.length - 1];
  var a = last, b = last, k = 0, i;
  if (t < last.t) {
    for (i = 0; i < PHASES.length - 1; i++) {
      if (t >= PHASES[i].t && t < PHASES[i + 1].t) {
        a = PHASES[i]; b = PHASES[i + 1];
        var f = (t - a.t) / (b.t - a.t);
        k = clamp((f - 0.5) * 2, 0, 1);
        break;
      }
    }
  }
  var warn = lerp(a.warn, b.warn, k);
  var gap = lerp(a.gap, b.gap, k);
  if (frenzy > 0) { warn *= 0.5; gap *= 0.5; }   /* frenzy: half warning, double rate */
  return {
    warn: warn,
    gap: gap,
    minA: a.minA,
    maxA: a.maxA,
    weights: a.w,
    cluster: lerp(a.cluster, b.cluster, k),
    phaseIndex: PHASES.indexOf(a)
  };
}

function scoreMult() {
  var m = 1;
  if (frenzy > 0) m *= 3;
  if (golden > 0) m *= 5;
  return m;
}

function addScore(n) {
  score += n;
  scoreF += n;
  if (!newHigh && score > highScore && highScore > 0) {
    newHigh = true;
    Sound.fanfare();
    floatText('NEW HIGH SCORE!', VW / 2, 210, '#ffd23f', 40, { max: 1.8, vy: -26 });
  }
}

/* ------------------------------------------------------------
   9. Mole actions
   ------------------------------------------------------------ */

/* Returns true if the mole actually moved. A false return with the cooldown
   still running is what the input buffer re-tries. */
function tryMove(dx, dy) {
  var m = mole;
  if (m.stun > 0 || m.state === 'burrowing' || m.moveCd > 0) return false;
  var nc = m.col + dx, nr = m.row + dy;
  if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) return false;  /* no wraparound */
  var to = idx(nc, nr);
  if (blocked[to] > 0) {
    Sound.blocked();
    var bp = pos(to);
    dustPuff(bp.x, bp.y - 10, 5, { color: '#c98b3a', size: 0.7 });
    return false;
  }
  var from = moleCell();
  var fp = pos(from), tp = pos(to);
  if (dx !== 0) m.facing = dx > 0 ? 1 : -1;

  if (m.state === 'above') {
    vulnLeft[from] = T;
    m.moveCd = MOVE_CD_ABOVE;
    dustPuff(fp.x, fp.y - 6, 7, { size: 0.8 });
    dustPuff(tp.x, tp.y - 6, 8, { size: 0.9 });
    m.col = nc; m.row = nr;
    m.popAnim = 0.2;
    Sound.pop(1.05);
  } else {
    m.moveCd = MOVE_CD_UNDER;
    m.col = nc; m.row = nr;
    Sound.dig(true);
    dustPuff(tp.x, tp.y + 4, 3, { size: 0.55 });
  }
  return true;
}

/* ---- key-hold repeat ----
   Every press acts immediately; the cooldown only exists to stop a single frame
   from eating several moves. Holding a direction repeats at its own slower rate
   so the mole doesn't rocket across the grid. Nothing is queued: a press that
   somehow lands inside the cooldown is simply ignored, never replayed later. */
var heldDirs = [];          /* direction key codes, most recent last */
var repeatTimer = MOVE_REPEAT;

function heldDir() {
  for (var i = heldDirs.length - 1; i >= 0; i--) {
    var d = DIRS[heldDirs[i]];
    if (d) return d;
  }
  return null;
}

function consumeMoveInput(dt) {
  var d = heldDir();
  if (!d) { repeatTimer = MOVE_REPEAT; return; }
  repeatTimer -= dt;
  if (repeatTimer > 0) return;
  if (mole.moveCd > 0 || mole.stun > 0 || mole.state === 'burrowing') return;
  if (tryMove(d[0], d[1])) repeatTimer = MOVE_REPEAT;
}

function tryBurrowToggle() {
  var m = mole;
  if (m.stun > 0 || m.state === 'burrowing') return;
  var p = pos(moleCell());
  if (m.state === 'above') {
    m.state = 'burrowing';
    m.tState = 0;
    vulnLeft[moleCell()] = T;   /* invulnerable from this instant */
    dustPuff(p.x, p.y - 4, 10, { size: 1 });
    Sound.dig(false);
  } else {
    m.state = 'above';
    m.under = UNDER_TIME;       /* full recharge on voluntary surfacing */
    m.popAnim = 0.24;
    dustPuff(p.x, p.y - 6, 9, { size: 0.9 });
    Sound.pop(1);
  }
}

function forceEject() {
  var m = mole;
  var p = pos(moleCell());
  m.state = 'above';
  m.under = 0;
  m.stun = EJECT_STUN;
  m.dazed = EJECT_STUN;
  m.popAnim = 0.4;
  m.ejectFlash = 0.5;
  Sound.sproing();
  shake(4, 0.2);
  dustPuff(p.x, p.y - 6, 20, { size: 1.3, spread: 1.4 });
  starBurst(p.x, p.y - 70, 6, '#9fe8ff');
  floatText('SPROING!', p.x, p.y - 120, '#9fe8ff', 30, { max: 0.9 });
}

function hitMole() {
  var m = mole;
  var p = pos(moleCell());
  lives--;
  stats.hits++;
  m.stun = HIT_STUN;
  m.dazed = HIT_STUN;
  m.invuln = HIT_INVULN;
  m.squished = 0.35;
  comboTier = 0; comboTimer = 0;
  flashRed = 0.5;
  shake(6, 0.22);
  slowMo(0.22, 0.75);            /* let the bonk land */
  Sound.bonk();
  starBurst(p.x, p.y - 70, 14, '#ffe066');
  dustPuff(p.x, p.y, 16, { size: 1.2, spread: 1.2 });
  floatText('OUCH!', p.x, p.y - 130, '#ff6b6b', 34, { max: 1.0 });
  if (lives <= 0) triggerGameOver();
}

function closeCall(cell) {
  stats.closeCalls++;
  stats.dodged++;
  if (comboTimer > 0) comboTier = Math.min(4, comboTier + 1);
  else comboTier = 1;
  comboTimer = COMBO_WINDOW;
  stats.longestCombo = Math.max(stats.longestCombo, comboTier);

  var pts = Math.round(25 * comboTier * scoreMult());
  addScore(pts);
  var p = pos(cell);
  var label = '+' + pts + ' CLOSE CALL!';
  floatText(label, p.x, p.y - 100, '#ffe066', comboTier > 1 ? 30 + comboTier * 4 : 28, { max: 1.15 });
  if (comboTier > 1) {
    floatText('x' + comboTier + ' COMBO', p.x, p.y - 148, '#ffb347', 24 + comboTier * 3, { max: 1.0, vy: -46 });
  }
  edgeFlash = 0.3;
  Sound.whoosh();
  Sound.ding(comboTier);
  starBurst(p.x, p.y - 40, 5, '#fff6b0');
}

function updateMole(dt) {
  var m = mole;
  if (m.invuln > 0) m.invuln -= dt;
  if (m.stun > 0) m.stun -= dt;
  if (m.dazed > 0) m.dazed -= dt;
  if (m.moveCd > 0) m.moveCd -= dt;
  if (m.squished > 0) m.squished -= dt;
  if (m.ejectFlash > 0) m.ejectFlash -= dt;
  if (m.popAnim > 0) m.popAnim = Math.max(0, m.popAnim - dt);
  m.bob += dt;

  if (m.state === 'burrowing') {
    m.tState += dt;
    if (m.tState >= BURROW_TIME) {
      m.state = 'under';
      m.tState = 0;
      m.under = UNDER_TIME;
    }
  } else if (m.state === 'under') {
    m.under -= dt;
    if (m.under <= 0) forceEject();
  }

  /* passive surface scoring: 10 pts/sec above ground */
  if (m.state === 'above') {
    scoreF += dt * 10 * scoreMult();
    var whole = Math.floor(scoreF);
    if (whole > score) {
      score = whole;
      if (!newHigh && score > highScore && highScore > 0) {
        newHigh = true;
        Sound.fanfare();
        floatText('NEW HIGH SCORE!', VW / 2, 210, '#ffd23f', 40, { max: 1.8, vy: -26 });
      }
    }
  }

  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) comboTier = 0;
  }
}

/* ------------------------------------------------------------
   10. Hammers — telegraph, strike, recovery
   ------------------------------------------------------------ */

function cellFree(i) {
  if (blocked[i] > 0) return false;
  for (var h = 0; h < hammers.length; h++) {
    if (hammers[h].cell === i && hammers[h].phase !== 'recover') return false;
  }
  return true;
}

function activeHammerCount() {
  var n = 0;
  for (var i = 0; i < hammers.length; i++) if (hammers[i].phase !== 'recover') n++;
  return n;
}

/* Hammers the player can actually see threatening a hole right now. */
function liveHammerCount() {
  var n = 0;
  for (var i = 0; i < hammers.length; i++) {
    var ph = hammers[i].phase;
    if (ph === 'warn' || ph === 'strike') n++;
  }
  return n;
}

function spawnHammer(cell, warn, delay) {
  var h = {
    cell: cell,
    warn: warn,
    delay: delay || 0,
    phase: (delay && delay > 0) ? 'delay' : 'warn',
    t: 0,
    resolved: false,
    wobble: rnd(0, Math.PI * 2),
    tilt: (Math.random() < 0.5 ? -1 : 1) * rnd(0.12, 0.3),
    scale: rnd(0.94, 1.08),
    queued: false
  };
  hammers.push(h);
  return h;
}

function weightedType(w) {
  var total = w.random + w.adjacent + w.direct + w.pattern;
  var r = Math.random() * total;
  if ((r -= w.random) < 0) return 'random';
  if ((r -= w.adjacent) < 0) return 'adjacent';
  if ((r -= w.direct) < 0) return 'direct';
  return 'pattern';
}

/* The decoy steals half of all player-seeking aim. */
function aimCell() {
  if (decoy && Math.random() < 0.5) return decoy.cell;
  return moleCell();
}

function neighbours(i) {
  var c = cellCol(i), r = cellRow(i), out = [];
  if (c > 0) out.push(idx(c - 1, r));
  if (c < COLS - 1) out.push(idx(c + 1, r));
  if (r > 0) out.push(idx(c, r - 1));
  if (r < ROWS - 1) out.push(idx(c, r + 1));
  return out;
}

function freeCells() {
  var out = [];
  for (var i = 0; i < NCELLS; i++) if (cellFree(i)) out.push(i);
  return out;
}

function spawnWave() {
  var d = difficulty();
  var type = weightedType(d.weights);
  var ref = aimCell();
  var warn = d.warn;
  var free = freeCells();
  if (!free.length) return;

  /* A hammer threatens its hole for (warning + strike) seconds. To keep `target`
     of them live on average when waves arrive every `gap` seconds, each wave has
     to carry target * gap / lifetime hammers — capped by the table's maximum. */
  var lifetime = warn + STRIKE_TIME;
  var target = rndInt(d.minA, d.maxA);
  var waveSize = clamp(Math.round(target * d.gap / lifetime), 1, d.maxA);
  var spawned = 0;

  var immediate = 0;
  function fire(cell, delay, queued) {
    if (spawned >= waveSize) return;
    if (!cellFree(cell)) return;
    /* hammers landing right now must respect the band's simultaneity cap */
    if (!delay && liveHammerCount() + immediate >= d.maxA) return;
    if (!delay) immediate++;
    spawnHammer(cell, warn, delay || 0).queued = !!queued;
    spawned++;
  }
  /* Patterns are set pieces — they ignore the wave budget so a sweep is never
     cut off half way across the row. */
  function patternFire(cell, delay) {
    if (!cellFree(cell)) return;
    spawnHammer(cell, warn, delay || 0);
    spawned++;
  }

  if (type === 'pattern') {
    var options = ['rowSweep', 'colSlam'];
    if (elapsed >= 45) options.push('cross');
    var pat = pick(options);
    var c, rr, k;

    /* Clear the runway so the set piece reads cleanly instead of landing on top
       of a pile of filler hammers. */
    for (k = 0; k < hammers.length; k++) {
      if (hammers[k].phase === 'delay' && hammers[k].queued) hammers[k].delay += 0.6;
    }

    if (pat === 'rowSweep') {
      var r = cellRow(ref);
      var dir = Math.random() < 0.5 ? 1 : -1;
      for (c = 0; c < COLS; c++) {
        patternFire(idx(dir > 0 ? c : COLS - 1 - c, r), c * 0.2);   /* 0.2s stagger */
      }
    } else if (pat === 'colSlam') {
      var col = cellCol(ref);
      for (rr = 0; rr < ROWS; rr++) patternFire(idx(col, rr), 0);   /* simultaneous */
    } else {
      patternFire(ref, 0);
      var nbs = neighbours(ref);
      for (k = 0; k < nbs.length; k++) patternFire(nbs[k], 0.04);
    }
    return;
  }

  if (type === 'random') {
    var count = 1;
    if (Math.random() < d.cluster) {                        /* random cluster */
      count = rndInt(2, 3);
    }
    var picks = shuffled(free).slice(0, count);
    for (var i = 0; i < picks.length; i++) fire(picks[i], i * 0.05);

  } else if (type === 'adjacent') {
    var nb = neighbours(ref).filter(cellFree);
    fire(nb.length ? pick(nb) : pick(free), 0);

  } else {                                                  /* player-direct */
    fire(cellFree(ref) ? ref : pick(free), 0);
  }

  /* Fill out the wave with randoms spread across the interval, so pressure is
     continuous instead of arriving as a wall followed by silence. */
  var guard = 0;
  while (spawned < waveSize && guard < 8) {
    guard++;
    var rest = freeCells();
    if (!rest.length) break;
    fire(pick(rest), rnd(0.06, d.gap * 0.85), true);
  }
}

function onStrikeStart(h) {
  var p = pos(h.cell);
  stats.strikes++;
  Sound.thwack(1);
  shake(3, 0.11);
  dustPuff(p.x, p.y - 2, 14, { size: 1.15, spread: 1.1 });
  shockwave(p.x, p.y, 'rgba(255,240,200,0.85)');

  var mi = moleCell();
  var onMole = (mi === h.cell);

  if (onMole && moleVulnerable()) {
    h.resolved = true;
    hitMole();
    return;
  }
  if (onMole) stats.dodged++;                       /* survived a direct slam */

  /* Close call: the mole was vulnerable on this hole moments ago. */
  if (T - vulnLeft[h.cell] <= CLOSE_WINDOW && golden <= 0 && mole.invuln <= 0) {
    closeCall(h.cell);
  }
}

function updateHammers(dt) {
  var cap = difficulty().maxA;
  for (var i = hammers.length - 1; i >= 0; i--) {
    var h = hammers[i];
    h.t += dt;
    if (h.phase === 'delay') {
      if (h.t >= h.delay) {
        /* filler hammers hold off rather than push the arena past the cap */
        if (h.queued && liveHammerCount() >= cap) h.delay += 0.08;
        else { h.phase = 'warn'; h.t = 0; }
      }
    } else if (h.phase === 'warn') {
      if (h.t >= h.warn) { h.phase = 'strike'; h.t = 0; onStrikeStart(h); }
    } else if (h.phase === 'strike') {
      /* the whole 0.3s is a danger window */
      if (!h.resolved && moleCell() === h.cell && moleVulnerable()) {
        h.resolved = true;
        hitMole();
      }
      if (h.t >= STRIKE_TIME) { h.phase = 'recover'; h.t = 0; }
    } else {
      if (h.t >= RECOVER_TIME) hammers.splice(i, 1);
    }
  }
}

/* ------------------------------------------------------------
   11. Wildcards
   ------------------------------------------------------------ */

function wildcardDef(id) {
  for (var i = 0; i < WILDCARDS.length; i++) if (WILDCARDS[i].id === id) return WILDCARDS[i];
  return null;
}

function pickWildcard() {
  var total = 0, i;
  for (i = 0; i < WILDCARDS.length; i++) total += WILDCARDS[i].weight;
  var r = Math.random() * total;
  for (i = 0; i < WILDCARDS.length; i++) {
    r -= WILDCARDS[i].weight;
    if (r < 0) return WILDCARDS[i];
  }
  return WILDCARDS[0];
}

/* Breadth-first search for the nearest hole that is not boarded up. */
function nearestFreeCell(from) {
  var seen = {}, queue = [from];
  seen[from] = true;
  while (queue.length) {
    var cur = queue.shift();
    if (blocked[cur] <= 0) return cur;
    var nb = neighbours(cur);
    for (var i = 0; i < nb.length; i++) {
      if (!seen[nb[i]]) { seen[nb[i]] = true; queue.push(nb[i]); }
    }
  }
  return from;
}

function startWildcard() {
  var def = pickWildcard();
  wild = { id: def.id, def: def, t: 0, dur: def.dur };
  banner(def.name, def.blurb, def.color);
  slowMo(0.3, 1.5);              /* the arena crawls while the announcement reads */
  Sound.chime(def.id);
  var i, p;

  if (def.id === 'lockdown') {
    var n = rndInt(3, 4);
    var cells = shuffled([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).slice(0, n);
    for (i = 0; i < cells.length; i++) {
      blocked[cells[i]] = def.dur;
      p = pos(cells[i]);
      dustPuff(p.x, p.y - 8, 8, { color: '#c98b3a', size: 0.9 });
    }
    /* Anything targeting a boarded hole is called off. */
    for (i = hammers.length - 1; i >= 0; i--) {
      if (blocked[hammers[i].cell] > 0 && hammers[i].phase !== 'strike') hammers.splice(i, 1);
    }
    if (blocked[moleCell()] > 0) {
      var dest = nearestFreeCell(moleCell());
      var op = pos(moleCell());
      dustPuff(op.x, op.y - 10, 12, { size: 1.1 });
      mole.col = cellCol(dest); mole.row = cellRow(dest);
      mole.state = 'above';
      mole.popAnim = 0.3;
      mole.moveCd = MOVE_CD_ABOVE;
      Sound.sproing();
      var np = pos(dest);
      dustPuff(np.x, np.y - 10, 12, { size: 1.1 });
      floatText('EVICTED!', np.x, np.y - 120, '#ff9130', 26, { max: 0.9 });
    }

  } else if (def.id === 'extralife') {
    var candidates = [];
    for (i = 0; i < NCELLS; i++) if (blocked[i] <= 0) candidates.push(i);
    pickup = { cell: pick(candidates), t: 0, dur: def.dur, taken: 0 };

  } else if (def.id === 'frenzy') {
    frenzy = def.dur;

  } else if (def.id === 'decoy') {
    var opts = [];
    for (i = 0; i < NCELLS; i++) if (blocked[i] <= 0 && i !== moleCell()) opts.push(i);
    if (!opts.length) opts = [moleCell()];
    decoy = { cell: pick(opts), t: 0, dur: def.dur, bob: 0 };
    p = pos(decoy.cell);
    dustPuff(p.x, p.y - 6, 8, { color: '#2fd4d4', size: 0.9 });

  } else if (def.id === 'quake') {
    quake = def.dur;
    var perm = shuffled([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (i = 0; i < NCELLS; i++) {
      holeTarget[i] = { x: basePos[perm[i]].x, y: basePos[perm[i]].y };
    }
    Sound.rumble();

  } else if (def.id === 'golden') {
    golden = def.dur;
  }
}

function endWildcard() {
  if (!wild) return;
  if (wild.id === 'quake') {
    for (var i = 0; i < NCELLS; i++) {
      holeTarget[i] = { x: basePos[i].x, y: basePos[i].y };
    }
  }
  wild = null;
}

function updateWildcards(dt) {
  var i, p;

  for (i = 0; i < NCELLS; i++) if (blocked[i] > 0) blocked[i] -= dt;

  if (frenzy > 0) {
    frenzy -= dt;
    if (Math.random() < dt * 24) {
      sparkle(rnd(0, VW), rnd(120, VH), '#c58bff');
    }
  }
  if (golden > 0) {
    golden -= dt;
    p = pos(moleCell());
    if (Math.random() < dt * 34) sparkle(p.x + rnd(-40, 40), p.y - rnd(10, 90), '#ffd23f');
  }
  if (quake > 0) quake -= dt;

  if (decoy) {
    decoy.t += dt;
    decoy.bob += dt;
    if (decoy.t >= decoy.dur) {
      p = pos(decoy.cell);
      dustPuff(p.x, p.y - 6, 8, { color: '#2fd4d4', size: 0.8 });
      decoy = null;
    }
  }

  if (pickup) {
    pickup.t += dt;
    if (!pickup.taken && moleCell() === pickup.cell && mole.state === 'above') {
      pickup.taken = 1;
      if (lives < MAX_LIVES) {
        lives++;
        floatText('+1 LIFE!', pos(pickup.cell).x, pos(pickup.cell).y - 110, '#ff5c8a', 34, { max: 1.3 });
      } else {
        addScore(200);
        floatText('+200 (LIVES FULL)', pos(pickup.cell).x, pos(pickup.cell).y - 110, '#ff5c8a', 26, { max: 1.3 });
      }
      Sound.collect();
      starBurst(pos(pickup.cell).x, pos(pickup.cell).y - 60, 12, '#ff9fc4');
      pickup = null;
    } else if (pickup && pickup.t >= pickup.dur) {
      pickup = null;
    }
  }

  /* one wildcard at a time; the next timer only runs while none is active */
  if (wild) {
    wild.t += dt;
    if (wild.t >= wild.dur) {
      endWildcard();
      wildTimer = rnd(12, 20);
    }
  } else {
    wildTimer -= dt;
    if (wildTimer <= 0) startWildcard();
  }

  /* animate hole positions (earthquake shuffle / settle back) */
  var k = Math.min(1, dt * 7);
  for (i = 0; i < NCELLS; i++) {
    holePos[i].x += (holeTarget[i].x - holePos[i].x) * k;
    holePos[i].y += (holeTarget[i].y - holePos[i].y) * k;
  }
  if (quake > 0) shake(5, 0.12);
}

/* ------------------------------------------------------------
   12. State machine & update
   ------------------------------------------------------------ */

var aiTimer = 0;

function goTitle() {
  state = S.TITLE;
  menuIndex = 0;
  autopilot = true;
  resetRun();
  elapsed = 8;               /* attract mode runs at a lively-but-fair pace */
  highScore = Store.highScore();
  Sound.startMusic();
}

function startGame() {
  autopilot = false;
  resetRun();
  state = S.PLAYING;
  dimAmount = 0;
  Sound.startMusic();
}

function startTutorial(returnTo) {
  autopilot = false;
  resetRun();
  state = S.TUTORIAL;
  tutorialStep = 0;
  tutorialT = 0;
  tutorialReturn = returnTo || 'game';
}

/* Where the tutorial hands off to: straight into a run on first play, back to
   the menu when it was opened from "How to play". */
function finishTutorial() {
  Store.setTutorialSeen();
  if (tutorialReturn === 'title') goTitle();
  else startGame();
}

function triggerGameOver() {
  if (autopilot) {                     /* the attract mole is immortal */
    lives = START_LIVES;
    return;
  }
  state = S.GAME_OVER;
  firstSession = false;
  gameOverPhase = 'countup';
  gameOverT = 0;
  countUp = 0;
  myRank = -1;
  initials = 'AAA';
  initialSlot = 0;
  mole.squished = 9999;
  Sound.stopMusic(0.8);
  Sound.gameOver();
  var p = pos(moleCell());
  dustPuff(p.x, p.y, 26, { size: 1.5, spread: 1.4 });
  starBurst(p.x, p.y - 40, 10, '#ffe066');
  shake(7, 0.35);
  slowMo(0.18, 1.1);
  if (Store.qualifies(score) && score > highScore) { newHigh = true; }
  if (newHigh) { popConfetti(150); Sound.fanfare(); }
}

function submitInitials() {
  var entry = { initials: initials, score: score, time: Math.round(elapsed * 10) / 10, date: Date.now() };
  myRank = Store.submit(entry);
  highScore = Store.highScore();
  gameOverPhase = 'done';
  Sound.select();
}

/* ---- attract-mode AI ---- */
function cellThreatened(cell) {
  for (var i = 0; i < hammers.length; i++) {
    var h = hammers[i];
    if (h.cell === cell && (h.phase === 'warn' || h.phase === 'strike')) return true;
  }
  return false;
}

function autopilotThink(dt) {
  aiTimer -= dt;
  var here = moleCell();
  if (mole.stun > 0) return;

  if (mole.state === 'above') {
    if (cellThreatened(here)) {
      if (Math.random() < 0.55) { tryBurrowToggle(); return; }
      var safe = neighbours(here).filter(function (n) { return !cellThreatened(n) && blocked[n] <= 0; });
      if (safe.length) {
        var t = pick(safe);
        tryMove(cellCol(t) - mole.col, cellRow(t) - mole.row);
        return;
      }
      tryBurrowToggle();
      return;
    }
    if (aiTimer <= 0) {
      aiTimer = rnd(0.35, 0.9);
      var opts = neighbours(here).filter(function (n) { return !cellThreatened(n) && blocked[n] <= 0; });
      if (opts.length && Math.random() < 0.8) {
        var d = pick(opts);
        tryMove(cellCol(d) - mole.col, cellRow(d) - mole.row);
      }
    }
  } else if (mole.state === 'under') {
    if (mole.under < 1.3 && !cellThreatened(here)) { tryBurrowToggle(); return; }
    if (cellThreatened(here) && aiTimer <= 0) {
      aiTimer = 0.2;
      var esc = neighbours(here).filter(function (n) { return !cellThreatened(n) && blocked[n] <= 0; });
      if (esc.length) {
        var e = pick(esc);
        tryMove(cellCol(e) - mole.col, cellRow(e) - mole.row);
      }
    }
  }
}

/* ---- per-frame simulation ---- */

function simulate(dt) {
  if (autopilot) {
    elapsed = Math.min(elapsed + dt, 22);
    autopilotThink(dt);
  } else {
    elapsed += dt;
  }

  if (!autopilot) consumeMoveInput(dt);
  updateMole(dt);
  updateHammers(dt);

  if (!autopilot) {
    updateWildcards(dt);
  } else {
    for (var i = 0; i < NCELLS; i++) if (blocked[i] > 0) blocked[i] -= dt;
    var k = Math.min(1, dt * 7);
    for (i = 0; i < NCELLS; i++) {
      holePos[i].x += (holeTarget[i].x - holePos[i].x) * k;
      holePos[i].y += (holeTarget[i].y - holePos[i].y) * k;
    }
  }

  var d = difficulty();
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnWave();
    spawnTimer = d.gap * rnd(0.88, 1.12);
  }

  if (!autopilot) {
    /* survival milestone */
    if (elapsed >= nextMilestone) {
      nextMilestone += MILESTONE;
      addScore(50);
      banner('+50 SURVIVAL BONUS', Math.round(elapsed) + ' SECONDS ALIVE', '#7ed957');
      slowMo(0.45, 0.9);
      Sound.milestone();
    }
    if (firstPlayHintTimer > 0) firstPlayHintTimer -= dt;
  }

  Sound.setTempo((128 + d.phaseIndex * 13 + (frenzy > 0 ? 22 : 0)) * (0.5 + 0.5 * timeScale));
  updateEffects(dt);
  displayScore += (score - displayScore) * Math.min(1, dt * 9);
  if (Math.abs(score - displayScore) < 0.5) displayScore = score;
}

function update(dt) {
  T += dt;
  updateBanners(dt);
  if (state === S.PLAYING || state === S.TITLE) {
    updateSlowMo(dt);
    simulate(dt * timeScale);
  } else if (state === S.TUTORIAL) {
    tutorialT += dt;
    updateEffects(dt);
  } else if (state === S.GAME_OVER) {
    gameOverT += dt;
    dimAmount = Math.min(0.62, dimAmount + dt * 1.24);
    updateEffects(dt);
    if (gameOverPhase === 'countup') {
      countUp = Math.min(1, countUp + dt / 1.1);
      displayScore = score * easeOutCubic(countUp);
      if (countUp >= 1) {
        displayScore = score;
        gameOverPhase = Store.qualifies(score) ? 'name' : 'done';
      }
    }
    if (newHigh && confetti.length < 40 && gameOverT < 4) popConfetti(3);
  }
}

/* ------------------------------------------------------------
   13. Input
   ------------------------------------------------------------ */

var DIRS = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1]
};
var BLOCK_DEFAULT = {
  ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1,
  Space: 1, Enter: 1, Backspace: 1, Tab: 1
};

function nudgeInitial(delta) {
  var i = CHARSET.indexOf(initials[initialSlot]);
  if (i < 0) i = 0;
  i = (i + delta + CHARSET.length) % CHARSET.length;
  initials = initials.substring(0, initialSlot) + CHARSET[i] + initials.substring(initialSlot + 1);
  Sound.select();
}

function setInitial(ch) {
  initials = initials.substring(0, initialSlot) + ch + initials.substring(initialSlot + 1);
  initialSlot = Math.min(2, initialSlot + 1);
  Sound.select();
}

/* Some environments (synthetic events, a few virtual keyboards) leave e.code
   empty. Fall back to e.key so the game stays playable there. */
function keyName(e) {
  if (e.code) return e.code;
  var k = e.key;
  if (!k) return '';
  if (k === ' ' || k === 'Spacebar') return 'Space';
  if (k.length === 1) {
    var u = k.toUpperCase();
    if (u >= 'A' && u <= 'Z') return 'Key' + u;
    if (u >= '0' && u <= '9') return 'Digit' + u;
  }
  return k;
}

function onKeyDown(e) {
  var code = keyName(e);
  if (BLOCK_DEFAULT[code]) e.preventDefault();
  if (e.repeat) return;

  Sound.unlock();

  if (code === 'KeyM') {
    var m = Sound.toggleMute();
    Store.setMuted(m);
    return;
  }

  if (state === S.TITLE) {
    if (code === 'ArrowUp' || code === 'KeyW' || code === 'ArrowDown' || code === 'KeyS') {
      menuIndex = 1 - menuIndex;
      Sound.select();
      return;
    }
    if (code === 'KeyH') { startTutorial('title'); return; }
    if (code === 'Space' || code === 'Enter') {
      if (menuIndex === 1) startTutorial('title');
      else if (Store.tutorialSeen()) startGame();
      else startTutorial('game');
    }
    return;
  }

  if (state === S.TUTORIAL) {
    if (tutorialStep === 0) {
      if (DIRS[code]) { tutorialStep = 1; tutorialT = 0; Sound.pop(1.1); return; }
      if (code === 'Space') { finishTutorial(); return; }                        /* skip */
    } else if (tutorialStep === 1) {
      if (code === 'Space') { tutorialStep = 2; tutorialT = 0; Sound.dig(true); return; }
    } else {
      if (code === 'Space' || code === 'Enter') { finishTutorial(); return; }
    }
    if (code === 'Escape') { Store.setTutorialSeen(); goTitle(); }
    return;
  }

  if (state === S.PLAYING) {
    if (code === 'Escape') { state = S.PAUSED; clearHeld(); Sound.stopMusic(0.2); return; }
    var d = DIRS[code];
    if (d) {
      if (heldDirs.indexOf(code) < 0) heldDirs.push(code);
      repeatTimer = MOVE_REPEAT;
      tryMove(d[0], d[1]);
      return;
    }
    if (code === 'Space') { tryBurrowToggle(); return; }
    return;
  }

  if (state === S.PAUSED) {
    if (code === 'Escape' || code === 'Space' || code === 'Enter') {
      state = S.PLAYING;
      Sound.startMusic();
    }
    return;
  }

  if (state === S.GAME_OVER) {
    if (gameOverPhase === 'countup') {
      if (code === 'Space' || code === 'Enter') {
        countUp = 1;
        displayScore = score;
        gameOverPhase = Store.qualifies(score) ? 'name' : 'done';
      }
      return;
    }
    if (gameOverPhase === 'name') {
      if (code === 'ArrowUp' || code === 'KeyW') { nudgeInitial(1); return; }
      if (code === 'ArrowDown' || code === 'KeyS') { nudgeInitial(-1); return; }
      if (code === 'ArrowLeft' || code === 'KeyA') { initialSlot = Math.max(0, initialSlot - 1); Sound.select(); return; }
      if (code === 'ArrowRight' || code === 'KeyD') { initialSlot = Math.min(2, initialSlot + 1); Sound.select(); return; }
      if (code === 'Backspace') { initialSlot = Math.max(0, initialSlot - 1); Sound.select(); return; }
      if (code === 'Enter') { submitInitials(); return; }
      var ch = e.key ? e.key.toUpperCase() : '';
      if (ch.length === 1 && CHARSET.indexOf(ch) >= 0) { setInitial(ch); return; }
      return;
    }
    /* done */
    if (code === 'Space' || code === 'Enter') { startGame(); return; }
    if (code === 'Escape') { goTitle(); return; }
  }
}

function onKeyUp(e) {
  var code = keyName(e);
  var i = heldDirs.indexOf(code);
  if (i >= 0) heldDirs.splice(i, 1);
}
function clearHeld() { heldDirs.length = 0; repeatTimer = MOVE_REPEAT; }

window.addEventListener('keydown', onKeyDown, { passive: false });
window.addEventListener('keyup', onKeyUp);
window.addEventListener('blur', clearHeld);

/* Clicking/tapping the canvas also unlocks audio and acts as "start". */
canvas.addEventListener('pointerdown', function () {
  Sound.unlock();
  if (state === S.TITLE) { Store.tutorialSeen() ? startGame() : startTutorial('game'); }
  else if (state === S.PAUSED) { state = S.PLAYING; Sound.startMusic(); }
});

document.addEventListener('visibilitychange', function () {
  if (document.hidden && state === S.PLAYING) {
    state = S.PAUSED;
    Sound.stopMusic(0.1);
  }
});

/* ------------------------------------------------------------
   14. Rendering — arena pieces
   ------------------------------------------------------------ */

function quakeJitter(i) {
  if (quake <= 0) return { x: 0, y: 0 };
  var k = Math.min(1, quake / 0.6);
  return {
    x: Math.sin(T * 41 + i * 1.7) * 5 * k,
    y: Math.cos(T * 37 + i * 2.3) * 4 * k
  };
}

function hp(i) {
  var p = holePos[i], j = quakeJitter(i);
  return { x: p.x + j.x, y: p.y + j.y };
}

function drawHole(i) {
  var p = hp(i);
  ctx.save();

  /* raised dirt rim */
  ctx.fillStyle = '#7a5533';
  ellipse(p.x, p.y + 7, HOLE_RX + 16, HOLE_RY + 12); ctx.fill();
  ctx.fillStyle = '#8c6440';
  ellipse(p.x, p.y + 3, HOLE_RX + 11, HOLE_RY + 9); ctx.fill();
  ctx.fillStyle = '#5f4227';
  ellipse(p.x, p.y + 1, HOLE_RX + 4, HOLE_RY + 4); ctx.fill();

  /* the hole itself */
  var g = ctx.createRadialGradient(p.x, p.y - 6, 4, p.x, p.y, HOLE_RX);
  g.addColorStop(0, '#0a0603');
  g.addColorStop(0.62, '#170e07');
  g.addColorStop(1, '#2c1c0f');
  ctx.fillStyle = g;
  ellipse(p.x, p.y, HOLE_RX, HOLE_RY); ctx.fill();

  /* inner top shadow lip */
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, HOLE_RX - 2, HOLE_RY - 2, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();

  ctx.restore();
}

/* Front half of the rim, drawn after entities so the mole sits "in" the hole. */
function drawHoleLip(i) {
  var p = hp(i);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, HOLE_RX + 4, HOLE_RY + 4, 0, 0.02 * Math.PI, 0.98 * Math.PI);
  ctx.lineTo(p.x - HOLE_RX - 16, p.y + HOLE_RY + 16);
  ctx.lineTo(p.x + HOLE_RX + 16, p.y + HOLE_RY + 16);
  ctx.closePath();
  ctx.fillStyle = '#7a5533';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 1, HOLE_RX + 4, HOLE_RY + 4, 0, 0.05 * Math.PI, 0.95 * Math.PI);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawBlocked(i) {
  if (blocked[i] <= 0) return;
  var p = hp(i);
  var fade = Math.min(1, blocked[i] / 0.35);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(p.x, p.y);
  var planks = [-14, 4, 22];
  for (var k = 0; k < planks.length; k++) {
    ctx.save();
    ctx.rotate((k - 1) * 0.16);
    ctx.fillStyle = k % 2 ? '#a9743c' : '#96632f';
    ctx.beginPath();
    ctx.roundRect(-HOLE_RX - 12, planks[k] - 22, (HOLE_RX + 12) * 2, 20, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,34,12,0.75)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    /* nails */
    ctx.fillStyle = '#4b3a22';
    circle(-HOLE_RX + 2, planks[k] - 12, 3); ctx.fill();
    circle(HOLE_RX - 2, planks[k] - 12, 3); ctx.fill();
    ctx.restore();
  }
  /* hazard glow */
  ctx.globalAlpha = fade * (0.28 + 0.16 * Math.sin(T * 9 + i));
  ctx.strokeStyle = '#ff9130';
  ctx.lineWidth = 5;
  ellipse(0, 0, HOLE_RX + 14, HOLE_RY + 12); ctx.stroke();
  ctx.restore();
}

function drawTelegraph(h) {
  if (h.phase !== 'warn') return;
  var p = hp(h.cell);
  var prog = clamp(h.t / h.warn, 0, 1);
  var pulse = 0.5 + 0.5 * Math.sin(T * (14 + prog * 22));
  ctx.save();

  /* danger glow filling the hole mouth */
  ctx.globalAlpha = 0.16 + 0.34 * prog;
  ctx.fillStyle = '#ff2f2f';
  ellipse(p.x, p.y, HOLE_RX + 6, HOLE_RY + 6); ctx.fill();

  /* static ring */
  ctx.globalAlpha = 0.45 + 0.4 * pulse * prog;
  ctx.strokeStyle = '#ff4040';
  ctx.lineWidth = 5;
  ellipse(p.x, p.y, HOLE_RX + 12, HOLE_RY + 10); ctx.stroke();

  /* closing crosshair ring — reads as a countdown */
  var rr = lerp(HOLE_RX + 78, HOLE_RX + 8, easeOutCubic(prog));
  var ry = rr * (HOLE_RY / HOLE_RX);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#ffdb4d';
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 12]);
  ctx.lineDashOffset = -T * 40;
  ellipse(p.x, p.y, rr, ry); ctx.stroke();
  ctx.setLineDash([]);

  /* crosshair ticks */
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = '#ff5555';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(p.x - rr - 12, p.y); ctx.lineTo(p.x - rr + 4, p.y);
  ctx.moveTo(p.x + rr - 4, p.y); ctx.lineTo(p.x + rr + 12, p.y);
  ctx.moveTo(p.x, p.y - ry - 10); ctx.lineTo(p.x, p.y - ry + 3);
  ctx.moveTo(p.x, p.y + ry - 3); ctx.lineTo(p.x, p.y + ry + 10);
  ctx.stroke();

  ctx.restore();
}

var HAMMER_RAISE = 350;

function hammerRaise(h) {
  if (h.phase === 'delay') return HAMMER_RAISE;
  if (h.phase === 'warn') {
    var descT = Math.min(0.16, h.warn * 0.45);
    var start = h.warn - descT;
    if (h.t < start) return HAMMER_RAISE - Math.sin(T * 6 + h.wobble) * 8;
    var k = (h.t - start) / descT;
    return HAMMER_RAISE * (1 - easeInCubic(k));
  }
  if (h.phase === 'strike') {
    return -6 * Math.exp(-h.t * 26) * Math.cos(h.t * 60);
  }
  return HAMMER_RAISE * easeOutCubic(clamp(h.t / RECOVER_TIME, 0, 1));
}

function drawHammerShape(alpha, scale) {
  ctx.globalAlpha = alpha;
  ctx.save();
  ctx.scale(scale, scale);

  /* handle */
  var hg = ctx.createLinearGradient(-14, 0, 14, 0);
  hg.addColorStop(0, '#7a4d22');
  hg.addColorStop(0.45, '#b57a3c');
  hg.addColorStop(1, '#6b4320');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.roundRect(-14, -216, 28, 200, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(48,28,10,0.85)';
  ctx.lineWidth = 3;
  ctx.stroke();
  /* grip bands */
  ctx.fillStyle = 'rgba(60,36,14,0.6)';
  ctx.fillRect(-14, -206, 28, 7);
  ctx.fillRect(-14, -190, 28, 7);

  /* head */
  var g = ctx.createLinearGradient(0, -40, 0, 40);
  g.addColorStop(0, '#eef2f7');
  g.addColorStop(0.28, '#c3cbd6');
  g.addColorStop(0.6, '#8f98a6');
  g.addColorStop(1, '#5f6773');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-76, -40, 152, 80, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(38,44,54,0.9)';
  ctx.lineWidth = 4;
  ctx.stroke();

  /* end caps */
  ctx.fillStyle = 'rgba(60,68,80,0.55)';
  ctx.beginPath(); ctx.roundRect(-76, -40, 22, 80, 12); ctx.fill();
  ctx.beginPath(); ctx.roundRect(54, -40, 22, 80, 12); ctx.fill();

  /* highlight */
  ctx.globalAlpha = alpha * 0.55;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(-46, -30, 92, 12, 6);
  ctx.fill();
  ctx.globalAlpha = alpha;

  /* bolts */
  ctx.fillStyle = '#6e7784';
  circle(-40, 4, 6); ctx.fill();
  circle(40, 4, 6); ctx.fill();

  ctx.restore();
}

function drawHammer(h) {
  var p = hp(h.cell);
  var raise = hammerRaise(h);
  var alpha = 1;
  if (h.phase === 'recover') alpha = 1 - clamp(h.t / RECOVER_TIME, 0, 1) * 0.85;
  if (h.phase === 'delay') return;

  var tilt;
  if (h.phase === 'warn') {
    var descT = Math.min(0.16, h.warn * 0.45);
    var start = h.warn - descT;
    if (h.t < start) tilt = h.tilt + Math.sin(T * 7 + h.wobble) * 0.07;
    else tilt = h.tilt * (1 - (h.t - start) / descT) * 0.9;
  } else if (h.phase === 'strike') {
    tilt = 0.02 * Math.sin(h.t * 40) * Math.exp(-h.t * 12);
  } else {
    tilt = h.tilt * 0.5 * (h.t / RECOVER_TIME);
  }

  /* ground shadow grows as it falls */
  var closeness = 1 - clamp(raise / HAMMER_RAISE, 0, 1);
  if (closeness > 0.02) {
    ctx.save();
    ctx.globalAlpha = 0.34 * closeness * alpha;
    ctx.fillStyle = '#000';
    ellipse(p.x, p.y + 4, (HOLE_RX + 4) * (0.55 + 0.45 * closeness), (HOLE_RY + 4) * (0.55 + 0.45 * closeness));
    ctx.fill();
    ctx.restore();
  }

  /* motion smear right after impact */
  if (h.phase === 'strike' && h.t < 0.07) {
    var smear = 1 - h.t / 0.07;
    for (var s = 1; s <= 2; s++) {
      ctx.save();
      ctx.translate(p.x, p.y - 44 - s * 44 * smear);
      ctx.rotate(tilt);
      drawHammerShape(alpha * 0.16 * smear / s, h.scale);
      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(p.x, p.y - 44 - raise);
  ctx.rotate(tilt);
  var sq = 1;
  if (h.phase === 'strike') sq = 1 + 0.10 * Math.exp(-h.t * 24);
  ctx.scale(sq, 1 / sq);
  drawHammerShape(alpha, h.scale);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------
   15. Rendering — the mole
   ------------------------------------------------------------ */

var FUR = { dark: '#6b4526', mid: '#8a5c33', light: '#a9743f', belly: '#d8b184' };
var DECOY_FUR = { dark: '#1f7d80', mid: '#2fa8ab', light: '#54c9cc', belly: '#bff0f0' };

function drawMoleBody(o) {
  var fur = o.decoy ? DECOY_FUR : FUR;
  var sx = o.sx, sy = o.sy;

  ctx.save();
  ctx.scale(sx, sy);

  if (o.gold) {
    ctx.shadowColor = 'rgba(255,210,63,0.9)';
    ctx.shadowBlur = 26;
  }

  /* body */
  var bg = ctx.createLinearGradient(0, -48, 0, 48);
  bg.addColorStop(0, o.gold ? '#ffe9a3' : fur.light);
  bg.addColorStop(0.55, o.gold ? '#ffc93c' : fur.mid);
  bg.addColorStop(1, o.gold ? '#d99b12' : fur.dark);
  ctx.fillStyle = bg;
  ellipse(0, 0, 42, 46); ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = o.gold ? 'rgba(120,80,0,0.75)' : 'rgba(46,28,12,0.8)';
  ctx.stroke();
  ctx.shadowBlur = 0;

  /* ears */
  ctx.fillStyle = o.gold ? '#e8ae1f' : fur.dark;
  circle(-30, -30, 12); ctx.fill();
  circle(30, -30, 12); ctx.fill();
  ctx.fillStyle = o.gold ? '#ffe9a3' : '#c98f66';
  circle(-30, -30, 6); ctx.fill();
  circle(30, -30, 6); ctx.fill();

  /* muzzle */
  ctx.fillStyle = o.gold ? '#fff3c9' : fur.belly;
  ellipse(0, 16, 28, 21); ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(46,28,12,0.35)';
  ctx.stroke();

  /* eyes */
  var ex = 15, ey = -8;
  if (o.closedEyes) {
    ctx.strokeStyle = '#2a1a0c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-ex, ey + 2, 8, Math.PI * 1.15, Math.PI * 1.85);
    ctx.arc(ex, ey + 2, 8, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else if (o.dazed) {
    ctx.strokeStyle = '#2a1a0c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-ex - 7, ey - 7); ctx.lineTo(-ex + 7, ey + 7);
    ctx.moveTo(-ex + 7, ey - 7); ctx.lineTo(-ex - 7, ey + 7);
    ctx.moveTo(ex - 7, ey - 7); ctx.lineTo(ex + 7, ey + 7);
    ctx.moveTo(ex + 7, ey - 7); ctx.lineTo(ex - 7, ey + 7);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#fff';
    circle(-ex, ey, 10); ctx.fill();
    circle(ex, ey, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(46,28,12,0.55)';
    ctx.lineWidth = 2;
    circle(-ex, ey, 10); ctx.stroke();
    circle(ex, ey, 10); ctx.stroke();
    var lookX = (o.facing || 1) * 2.4;
    ctx.fillStyle = '#1b1109';
    circle(-ex + lookX, ey + 1, 5.4); ctx.fill();
    circle(ex + lookX, ey + 1, 5.4); ctx.fill();
    ctx.fillStyle = '#fff';
    circle(-ex + lookX + 2, ey - 2.5, 2.1); ctx.fill();
    circle(ex + lookX + 2, ey - 2.5, 2.1); ctx.fill();
  }

  /* nose */
  ctx.fillStyle = o.decoy ? '#ff8fb3' : '#ff8fa8';
  ellipse(0, 8, 8, 6.5); ctx.fill();
  ctx.strokeStyle = 'rgba(120,40,60,0.5)';
  ctx.lineWidth = 2; ctx.stroke();

  /* mouth */
  ctx.strokeStyle = '#5a3a1c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 14);
  if (o.dazed) { ctx.arc(0, 22, 7, Math.PI * 1.15, Math.PI * 1.85, false); }
  else { ctx.arc(0, 14, 9, Math.PI * 0.15, Math.PI * 0.85, false); }
  ctx.stroke();

  /* whiskers */
  ctx.strokeStyle = 'rgba(40,24,10,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (var w = -1; w <= 1; w++) {
    ctx.moveTo(-9, 8 + w * 5); ctx.lineTo(-34, 4 + w * 10);
    ctx.moveTo(9, 8 + w * 5); ctx.lineTo(34, 4 + w * 10);
  }
  ctx.stroke();

  /* paws */
  ctx.fillStyle = o.gold ? '#ffdd7a' : fur.belly;
  ellipse(-26, 40, 13, 9); ctx.fill();
  ellipse(26, 40, 13, 9); ctx.fill();
  ctx.strokeStyle = 'rgba(46,28,12,0.5)';
  ctx.lineWidth = 2.5;
  ellipse(-26, 40, 13, 9); ctx.stroke();
  ellipse(26, 40, 13, 9); ctx.stroke();
  ctx.strokeStyle = '#f4e0c0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (var c = -1; c <= 1; c++) {
    ctx.moveTo(-26 + c * 5, 44); ctx.lineTo(-26 + c * 5, 48);
    ctx.moveTo(26 + c * 5, 44); ctx.lineTo(26 + c * 5, 48);
  }
  ctx.stroke();

  /* wind-up key marks the decoy as a fake */
  if (o.decoy) {
    ctx.strokeStyle = '#0f5c5e';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(0, -62); ctx.stroke();
    ctx.beginPath(); ctx.arc(-9, -66, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(9, -66, 9, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.restore();
}

function drawDazeStars(x, y, count, speed) {
  for (var i = 0; i < count; i++) {
    var a = T * speed + (i / count) * Math.PI * 2;
    var sx = x + Math.cos(a) * 40;
    var sy = y + Math.sin(a) * 13;
    ctx.save();
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(a * 2);
    ctx.fillStyle = '#ffe066';
    star(sx, sy, 9, 4, 5, a * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,0,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

/* rise: 0 = fully underground, 1 = fully up */
function drawMoleAt(x, y, rise, o) {
  o = o || {};
  var cy = y + 34 - 76 * rise;

  ctx.save();
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;

  /* contact shadow */
  ctx.save();
  ctx.globalAlpha *= 0.3 * rise;
  ctx.fillStyle = '#000';
  ellipse(x, y + 2, 38, 14); ctx.fill();
  ctx.restore();

  ctx.translate(x, cy);
  drawMoleBody({
    sx: o.sx === undefined ? 1 : o.sx,
    sy: o.sy === undefined ? 1 : o.sy,
    gold: o.gold, decoy: o.decoy, dazed: o.dazed,
    closedEyes: o.closedEyes, facing: o.facing
  });
  ctx.restore();

  if (o.dazed) drawDazeStars(x, cy - 62, 3, 4.2);
}

function drawPlayerMole() {
  var m = mole;
  var p = hp(moleCell());
  var rise = 1, sx = 1, sy = 1;

  if (m.state === 'under') return;                 /* only the tell shows */
  if (m.state === 'burrowing') {
    rise = 1 - easeInCubic(clamp(m.tState / BURROW_TIME, 0, 1));
    sx = 1 + 0.18 * (1 - rise);
    sy = 1 - 0.2 * (1 - rise);
  } else if (m.popAnim > 0) {
    var k = 1 - m.popAnim / 0.4;
    var e = easeOutBack(clamp(m.popAnim > 0 ? (0.4 - m.popAnim) / 0.4 : 1, 0, 1));
    rise = clamp(e, 0, 1.06);
    sx = 1 - 0.22 * Math.sin(Math.PI * clamp(k, 0, 1));
    sy = 1 + 0.26 * Math.sin(Math.PI * clamp(k, 0, 1));
  }

  var bob = m.state === 'above' && m.stun <= 0 ? Math.sin(m.bob * 4.5) * 0.02 : 0;
  sy += bob; sx -= bob * 0.5;

  var alpha = 1;
  if (m.invuln > 0 && m.stun <= 0) alpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(T * 26));

  if (m.squished > 0 && state === S.GAME_OVER) { sx = 1.75; sy = 0.3; rise = 0.55; }

  drawMoleAt(p.x, p.y, rise, {
    sx: sx, sy: sy, alpha: alpha,
    gold: golden > 0,
    dazed: m.dazed > 0,
    facing: m.facing
  });

  if (golden > 0) {
    ctx.save();
    ctx.globalAlpha = 0.28 + 0.16 * Math.sin(T * 8);
    ctx.fillStyle = '#ffd23f';
    circle(p.x, p.y - 40, 78); ctx.fill();
    ctx.restore();
  }
}

/* Subtle "I'm down here" tell: two eyes and a little dirt shiver. */
function drawUndergroundTell() {
  if (mole.state !== 'under') return;
  var p = hp(moleCell());
  var wob = Math.sin(T * 6) * 2;

  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#efe6d4';
  ellipse(p.x - 9 + wob * 0.3, p.y - 4, 5.5, 4); ctx.fill();
  ellipse(p.x + 9 + wob * 0.3, p.y - 4, 5.5, 4); ctx.fill();
  ctx.fillStyle = '#1b1109';
  circle(p.x - 9 + wob * 0.5, p.y - 3.4, 2.6); ctx.fill();
  circle(p.x + 9 + wob * 0.5, p.y - 3.4, 2.6); ctx.fill();
  ctx.restore();

  if (Math.random() < 0.06) {
    spawnParticle({
      type: 'dust', x: p.x + rnd(-20, 20), y: p.y + 2,
      vx: rnd(-14, 14), vy: rnd(-40, -14),
      life: 0, max: 0.5, size: rnd(3, 7), grav: 120, color: '#7d5836'
    });
  }
}

function drawUndergroundTimer() {
  if (mole.state !== 'under') return;
  var p = hp(moleCell());
  var frac = clamp(mole.under / UNDER_TIME, 0, 1);
  var rx = HOLE_RX + 20, ry = HOLE_RY + 16;

  ctx.save();
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.32)';
  ellipse(p.x, p.y, rx, ry); ctx.stroke();

  var col = frac > 0.55 ? '#5ce16a' : (frac > 0.28 ? '#ffd23f' : '#ff4d4d');
  if (frac <= 0.28) {
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(T * 22);
  }
  ctx.strokeStyle = col;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
  ctx.stroke();
  ctx.restore();
}

function drawDecoy() {
  if (!decoy) return;
  var p = hp(decoy.cell);
  var fadeIn = clamp(decoy.t / 0.22, 0, 1);
  var fadeOut = clamp((decoy.dur - decoy.t) / 0.3, 0, 1);
  drawMoleAt(p.x, p.y, easeOutBack(fadeIn), {
    decoy: true,
    alpha: 0.95 * fadeOut,
    sy: 1 + Math.sin(decoy.bob * 7) * 0.05,
    sx: 1 - Math.sin(decoy.bob * 7) * 0.03,
    facing: Math.sin(decoy.bob * 2) > 0 ? 1 : -1
  });
}

function drawPickup() {
  if (!pickup) return;
  var p = hp(pickup.cell);
  var left = pickup.dur - pickup.t;
  var y = p.y - 92 + Math.sin(T * 4) * 9;
  ctx.save();
  if (left < 1) ctx.globalAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(T * 20));

  ctx.globalAlpha *= 0.35;
  ctx.fillStyle = '#ff5c8a';
  circle(p.x, y, 40 + Math.sin(T * 6) * 5); ctx.fill();
  ctx.globalAlpha = left < 1 ? (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(T * 20))) : 1;

  ctx.shadowColor = 'rgba(255,92,138,0.9)';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#ff5c8a';
  heart(p.x, y, 24); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#8c1f3f';
  ctx.lineWidth = 3.5;
  heart(p.x, y, 24); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ellipse(p.x - 8, y - 10, 5, 3.5); ctx.fill();

  /* beam to the hole so the target hole is unmistakable */
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ff5c8a';
  ctx.beginPath();
  ctx.moveTo(p.x - 16, y + 14);
  ctx.lineTo(p.x + 16, y + 14);
  ctx.lineTo(p.x + HOLE_RX * 0.7, p.y);
  ctx.lineTo(p.x - HOLE_RX * 0.7, p.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (Math.random() < 0.4) sparkle(p.x + rnd(-30, 30), y + rnd(-20, 20), '#ffc0d6');
}

/* ------------------------------------------------------------
   16. Rendering — particles, HUD, overlays
   ------------------------------------------------------------ */

function drawParticles() {
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    var k = p.life / p.max;
    ctx.save();
    ctx.globalAlpha = 1 - k * k;
    if (p.type === 'dust') {
      ctx.fillStyle = p.color;
      circle(p.x, p.y, p.size * (1 - k * 0.45)); ctx.fill();
    } else if (p.type === 'star') {
      ctx.fillStyle = p.color;
      star(p.x, p.y, p.size, p.size * 0.45, 5, p.rot);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,80,0,0.6)';
      ctx.lineWidth = 2; ctx.stroke();
    } else if (p.type === 'spark') {
      ctx.fillStyle = p.color;
      circle(p.x, p.y, p.size * (1 - k)); ctx.fill();
    } else if (p.type === 'ring') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 7 * (1 - k);
      var rr = p.size + 120 * easeOutCubic(k);
      ellipse(p.x, p.y, rr, rr * 0.45); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawFloaters() {
  for (var i = 0; i < floaters.length; i++) {
    var f = floaters[i];
    var k = f.life / f.max;
    var s = f.size * (f.life < f.pop ? easeOutBack(f.life / f.pop) : 1);
    ctx.save();
    ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    text(f.text, f.x, f.y, Math.max(1, s), f.color, { outline: Math.max(3, s * 0.16) });
    ctx.restore();
  }
}

function drawConfetti() {
  for (var i = 0; i < confetti.length; i++) {
    var c = confetti[i];
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * (0.4 + 0.6 * Math.abs(Math.sin(c.rot))));
    ctx.restore();
  }
}

function drawMoleIcon(x, y, r, alive) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(r / 24, r / 24);
  ctx.fillStyle = alive ? '#8a5c33' : 'rgba(0,0,0,0.34)';
  circle(0, 0, 22); ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = alive ? 'rgba(46,28,12,0.9)' : 'rgba(0,0,0,0.35)';
  ctx.stroke();
  ctx.fillStyle = alive ? '#6b4526' : 'rgba(0,0,0,0.3)';
  circle(-16, -15, 7); ctx.fill();
  circle(16, -15, 7); ctx.fill();
  ctx.fillStyle = alive ? '#d8b184' : 'rgba(255,255,255,0.16)';
  ellipse(0, 8, 14, 10); ctx.fill();
  if (alive) {
    ctx.fillStyle = '#1b1109';
    circle(-8, -4, 3.6); ctx.fill();
    circle(8, -4, 3.6); ctx.fill();
    ctx.fillStyle = '#ff8fa8';
    ellipse(0, 3, 4.4, 3.6); ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-12, -8); ctx.lineTo(-4, 0);
    ctx.moveTo(-4, -8); ctx.lineTo(-12, 0);
    ctx.moveTo(4, -8); ctx.lineTo(12, 0);
    ctx.moveTo(12, -8); ctx.lineTo(4, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHUD() {
  ctx.save();

  /* bar */
  ctx.beginPath();
  ctx.roundRect(-40, -60, VW + 80, 178, 34);
  var g = ctx.createLinearGradient(0, 0, 0, 118);
  g.addColorStop(0, 'rgba(24,14,6,0.62)');
  g.addColorStop(1, 'rgba(24,14,6,0.18)');
  ctx.fillStyle = g;
  ctx.fill();

  /* lives */
  text('LIVES', 40, 32, 17, '#ffe9c9', { align: 'left', outline: 3 });
  for (var i = 0; i < MAX_LIVES; i++) {
    if (i >= START_LIVES && i >= lives) continue;         /* only show earned slots */
    var alive = i < lives;
    var pulse = (alive && i === lives - 1 && lives === 1) ? 1 + 0.08 * Math.sin(T * 10) : 1;
    drawMoleIcon(58 + i * 48, 74, 20 * pulse, alive);
  }

  /* score */
  var sc = Math.round(displayScore);
  var scPulse = 1 + Math.min(0.12, Math.abs(score - displayScore) / 260);
  ctx.save();
  ctx.translate(VW / 2, 50);
  ctx.scale(scPulse, scPulse);
  text(String(sc), 0, 0, 58, newHigh ? '#ffd23f' : '#ffffff', { outline: 8 });
  ctx.restore();

  var hsCol = '#ffe9c9';
  var hsLabel = 'HIGH  ' + Math.max(highScore, newHigh ? score : 0);
  if (newHigh) {
    ctx.save();
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(T * 8);
    text('NEW BEST!', VW / 2, 96, 22, '#ffd23f', { outline: 4 });
    ctx.restore();
  } else {
    text(hsLabel, VW / 2, 96, 20, hsCol, { outline: 4 });
  }

  /* timer */
  text('TIME', VW - 40, 32, 17, '#ffe9c9', { align: 'right', outline: 3 });
  text(elapsed.toFixed(1), VW - 40, 72, 36, '#ffffff', { align: 'right', outline: 6 });

  ctx.restore();

  /* active wildcard pill */
  if (wild) {
    var w = 250, x = VW - w - 34, y = 130;
    var left = 1 - wild.t / wild.dur;
    ctx.save();
    panel(x, y, w, 44, 12, 'rgba(20,12,6,0.62)', wild.def.color, 3);
    text(wild.def.name, x + w / 2, y + 17, 18, wild.def.color, { outline: 3 });
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.roundRect(x + 14, y + 30, w - 28, 7, 4); ctx.fill();
    ctx.fillStyle = wild.def.color;
    ctx.beginPath(); ctx.roundRect(x + 14, y + 30, (w - 28) * clamp(left, 0, 1), 7, 4); ctx.fill();
    ctx.restore();
  }

  /* combo meter near the mole */
  if (comboTier > 1 && state === S.PLAYING) {
    var mp = hp(moleCell());
    var cy = mp.y - 150;
    ctx.save();
    ctx.globalAlpha = clamp(comboTimer / 0.6, 0, 1);
    text('x' + comboTier + ' COMBO', mp.x, cy, 26, '#ffb347', { outline: 5 });
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.roundRect(mp.x - 46, cy + 18, 92, 8, 4); ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.roundRect(mp.x - 46, cy + 18, 92 * clamp(comboTimer / COMBO_WINDOW, 0, 1), 8, 4); ctx.fill();
    ctx.restore();
  }

  /* first-play controls hint */
  if (firstPlayHintTimer > 0 && state === S.PLAYING) {
    ctx.save();
    ctx.globalAlpha = clamp(firstPlayHintTimer / 1.4, 0, 1) * 0.9;
    text('ARROWS / WASD to move     SPACE to burrow     ESC to pause     M to mute',
         VW / 2, VH - 26, 20, '#fff8e6', { outline: 4 });
    ctx.restore();
  }
}

function drawBanners() {
  for (var i = 0; i < banners.length; i++) {
    var b = banners[i];
    var k = b.life / b.max;
    var slide = k < 0.16 ? easeOutBack(k / 0.16) : 1;
    var alpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    /* Parked in the gap between the HUD bar and the top row of holes so an
       announcement never covers a hole the player has to read. */
    var y = 172;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(VW / 2, y);
    ctx.scale(slide, slide);
    var w = Math.max(430, measure(b.title, 34) + 110);
    panel(-w / 2, -44, w, 88, 18, 'rgba(18,10,4,0.86)', b.color, 5);
    text(b.title, 0, -13, 33, b.color, { outline: 5 });
    text(b.blurb, 0, 21, 19, '#fff3dd', { outline: 4 });
    ctx.restore();
  }
}

function drawScreenFx() {
  if (frenzy > 0) {
    var pulse = 0.35 + 0.3 * Math.sin(T * 12);
    ctx.save();
    ctx.globalAlpha = pulse * clamp(frenzy, 0, 1);
    var eg = ctx.createLinearGradient(0, 0, 0, VH);
    eg.addColorStop(0, 'rgba(164,92,255,0.9)');
    eg.addColorStop(0.18, 'rgba(164,92,255,0)');
    eg.addColorStop(0.82, 'rgba(164,92,255,0)');
    eg.addColorStop(1, 'rgba(164,92,255,0.9)');
    ctx.fillStyle = eg;
    ctx.fillRect(0, 0, VW, VH);
    var eg2 = ctx.createLinearGradient(0, 0, VW, 0);
    eg2.addColorStop(0, 'rgba(164,92,255,0.9)');
    eg2.addColorStop(0.14, 'rgba(164,92,255,0)');
    eg2.addColorStop(0.86, 'rgba(164,92,255,0)');
    eg2.addColorStop(1, 'rgba(164,92,255,0.9)');
    ctx.fillStyle = eg2;
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
  }
  if (golden > 0) {
    ctx.save();
    ctx.globalAlpha = 0.18 * clamp(golden, 0, 1);
    var gg = ctx.createRadialGradient(VW / 2, VH / 2, 200, VW / 2, VH / 2, 760);
    gg.addColorStop(0, 'rgba(255,210,63,0)');
    gg.addColorStop(1, 'rgba(255,210,63,1)');
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
  }
  if (timeScale < 0.98) {
    var sm = (1 - timeScale) / (1 - Math.min(0.95, slowMin) + 0.0001);
    ctx.save();
    ctx.globalAlpha = clamp(sm, 0, 1) * 0.5;
    var smg = ctx.createRadialGradient(VW / 2, VH / 2, 240, VW / 2, VH / 2, 820);
    smg.addColorStop(0, 'rgba(10,16,40,0)');
    smg.addColorStop(1, 'rgba(10,16,40,0.95)');
    ctx.fillStyle = smg;
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
  }
  if (edgeFlash > 0) {
    ctx.save();
    ctx.globalAlpha = edgeFlash * 0.7;
    var wg = ctx.createRadialGradient(VW / 2, VH / 2, 260, VW / 2, VH / 2, 780);
    wg.addColorStop(0, 'rgba(255,255,255,0)');
    wg.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
  }
  if (flashRed > 0) {
    ctx.save();
    ctx.globalAlpha = flashRed * 0.55;
    ctx.fillStyle = '#ff2020';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
  }
  if (dimAmount > 0) {
    ctx.save();
    ctx.globalAlpha = dimAmount;
    ctx.fillStyle = '#0a0d08';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
  }
}

/* ------------------------------------------------------------
   17. Arena composition
   ------------------------------------------------------------ */

function drawArena() {
  var i, r;

  for (i = 0; i < NCELLS; i++) drawHole(i);
  for (i = 0; i < NCELLS; i++) {
    for (var h = 0; h < hammers.length; h++) if (hammers[h].cell === i) drawTelegraph(hammers[h]);
  }
  drawUndergroundTimer();

  /* row-by-row so front rows overlap back rows correctly */
  for (r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var cell = idx(c, r);
      if (mole && moleCell() === cell) { drawUndergroundTell(); drawPlayerMole(); }
      if (decoy && decoy.cell === cell) drawDecoy();
    }
    for (c = 0; c < COLS; c++) drawHoleLip(idx(c, r));
    for (c = 0; c < COLS; c++) drawBlocked(idx(c, r));
    for (c = 0; c < COLS; c++) {
      if (pickup && pickup.cell === idx(c, r)) drawPickup();
      for (var k = 0; k < hammers.length; k++) {
        if (hammers[k].cell === idx(c, r)) drawHammer(hammers[k]);
      }
    }
  }

  drawParticles();
  drawFloaters();
}

/* ------------------------------------------------------------
   18. Screens
   ------------------------------------------------------------ */

function drawKeyCap(x, y, w, h, label, highlight) {
  ctx.save();
  panel(x - w / 2, y - h / 2, w, h, 8,
        highlight ? 'rgba(255,210,63,0.9)' : 'rgba(255,255,255,0.16)',
        highlight ? '#fff3c9' : 'rgba(255,255,255,0.55)', 3);
  text(label, x, y + 1, h * 0.44, highlight ? '#3a2508' : '#fff8e6', { outline: 0, shadow: false });
  ctx.restore();
}

function drawTitleScreen() {
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,8,0.38)';
  ctx.fillRect(0, 0, VW, VH);
  var tg = ctx.createLinearGradient(0, 0, 0, 300);
  tg.addColorStop(0, 'rgba(8,14,6,0.6)');
  tg.addColorStop(1, 'rgba(8,14,6,0)');
  ctx.fillStyle = tg;
  ctx.fillRect(0, 0, VW, 300);
  ctx.restore();

  var bounce = Math.sin(T * 2.2) * 8;
  ctx.save();
  ctx.translate(VW / 2, 150 + bounce);
  ctx.rotate(Math.sin(T * 1.1) * 0.014);
  text('UNHAMMERED', 0, 0, 92, '#ffd23f', { outline: 14, outlineColor: '#3a2508' });
  ctx.restore();

  text('REVERSE WHACK-A-MOLE', VW / 2, 216, 26, '#fff3dd', { outline: 5 });

  var hs = Store.highScore();
  if (hs > 0) {
    var b = Store.board()[0];
    text('BEST  ' + hs + '  by ' + (b ? b.initials : '---'), VW / 2, 262, 24, '#9fe8ff', { outline: 5 });
  }

  ctx.save();
  var sg = ctx.createLinearGradient(0, VH - 290, 0, VH);
  sg.addColorStop(0, 'rgba(8,14,6,0)');
  sg.addColorStop(0.45, 'rgba(8,14,6,0.42)');
  sg.addColorStop(1, 'rgba(8,14,6,0.6)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, VH - 290, VW, 290);
  ctx.restore();

  var items = ['START GAME', 'HOW TO PLAY'];
  var pulse = 0.62 + 0.38 * Math.sin(T * 4.2);
  for (var i = 0; i < items.length; i++) {
    var iy = VH - 200 + i * 62;
    var sel = (i === menuIndex);
    var size = sel ? 40 : 31;
    ctx.save();
    ctx.globalAlpha = sel ? pulse : 0.62;
    if (sel) {
      var wgt = measure(items[i], size) + 96;
      panel(VW / 2 - wgt / 2, iy - 27, wgt, 54, 14,
            'rgba(255,210,63,0.13)', 'rgba(255,210,63,0.75)', 3);
      text('\u25B6', VW / 2 - wgt / 2 + 28, iy, 20, '#ffd23f', { outline: 3 });
    }
    text(items[i], VW / 2, iy, size, sel ? '#ffffff' : '#e9f7d8', { outline: sel ? 7 : 5 });
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = 0.82;
  text('\u2191\u2193 choose     SPACE select', VW / 2, VH - 62, 19, '#cfe6c0', { outline: 3 });
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.75;
  text(Sound.isMuted() ? 'SOUND: OFF' : 'SOUND: ON', VW - 36, VH - 18, 15, '#cfe6c0',
       { align: 'right', outline: 3 });
  ctx.restore();
}

function drawTutorialIllustration(step) {
  var cx = VW / 2;
  if (step === 0) {
    var cy = 400;
    var lit = Math.floor(T * 2.4) % 4;
    drawKeyCap(cx, cy - 34, 62, 56, '\u2191', lit === 0);
    drawKeyCap(cx - 68, cy + 28, 62, 56, '\u2190', lit === 1);
    drawKeyCap(cx, cy + 28, 62, 56, '\u2193', lit === 2);
    drawKeyCap(cx + 68, cy + 28, 62, 56, '\u2192', lit === 3);
    text('or  W A S D', cx + 196, cy, 22, '#fff3dd', { outline: 4 });

  } else if (step === 1) {
    var p = { x: cx + 30, y: 428 };
    ctx.save();
    ctx.fillStyle = '#7a5533';
    ellipse(p.x, p.y + 6, HOLE_RX + 14, HOLE_RY + 11); ctx.fill();
    ctx.fillStyle = '#150d06';
    ellipse(p.x, p.y, HOLE_RX, HOLE_RY); ctx.fill();
    ctx.fillStyle = '#efe6d4';
    ellipse(p.x - 9, p.y - 4, 5.5, 4); ctx.fill();
    ellipse(p.x + 9, p.y - 4, 5.5, 4); ctx.fill();
    ctx.fillStyle = '#1b1109';
    circle(p.x - 9, p.y - 3.4, 2.6); ctx.fill();
    circle(p.x + 9, p.y - 3.4, 2.6); ctx.fill();

    var frac = 1 - (tutorialT % 3) / 3;
    ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ellipse(p.x, p.y, HOLE_RX + 20, HOLE_RY + 16); ctx.stroke();
    ctx.strokeStyle = frac > 0.55 ? '#5ce16a' : (frac > 0.28 ? '#ffd23f' : '#ff4d4d');
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, HOLE_RX + 20, HOLE_RY + 16, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();
    ctx.restore();
    drawKeyCap(cx - 190, 428, 150, 54, 'SPACE', true);
    text('3.0s', p.x, p.y + 74, 20, '#ffe9c9', { outline: 3 });

  } else {
    var q = { x: cx + 120, y: 462 };
    var pr = (tutorialT % 1.5) / 1.5;

    ctx.save();
    ctx.fillStyle = '#7a5533';
    ellipse(q.x, q.y + 6, HOLE_RX + 14, HOLE_RY + 11); ctx.fill();
    ctx.fillStyle = '#150d06';
    ellipse(q.x, q.y, HOLE_RX, HOLE_RY); ctx.fill();
    ctx.globalAlpha = 0.18 + 0.38 * pr;
    ctx.fillStyle = '#ff2f2f';
    ellipse(q.x, q.y, HOLE_RX + 6, HOLE_RY + 6); ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#ffdb4d';
    ctx.lineWidth = 4;
    ctx.setLineDash([16, 12]);
    var rr = lerp(HOLE_RX + 60, HOLE_RX + 8, easeOutCubic(pr));
    ellipse(q.x, q.y, rr, rr * (HOLE_RY / HOLE_RX)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.save();
    ctx.translate(q.x, q.y - 27 - 64 * (1 - easeInCubic(pr)));
    ctx.rotate(-0.16 * (1 - pr));
    ctx.scale(0.4, 0.4);
    drawHammerShape(1, 1);
    ctx.restore();

    drawMoleAt(cx - 150, 462, 1, { facing: 1 });
    text('+10 / sec', cx - 150, 356, 22, '#7ed957', { outline: 4 });
  }
}

function drawTutorial() {
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,6,0.7)';
  ctx.fillRect(0, 0, VW, VH);
  ctx.restore();

  var steps = [
    { title: 'YOU ARE THE MOLE', body: 'Arrow keys or WASD move you between holes.' },
    { title: 'SPACE TO HIDE', body: 'Underground you are safe — but only for 3 seconds.' },
    { title: 'SURFACE TO SCORE', body: 'Points only tick up above ground. Dodge the hammers!' }
  ];
  var s = steps[tutorialStep];

  panel(230, 140, 820, 424, 26, 'rgba(18,10,4,0.88)', '#ffd23f', 5);
  text(s.title, VW / 2, 202, 46, '#ffd23f', { outline: 7 });
  text(s.body, VW / 2, 250, 24, '#fff3dd', { outline: 4 });
  drawTutorialIllustration(tutorialStep);

  text('STEP ' + (tutorialStep + 1) + ' / 3', VW / 2, 536, 20, '#cfe6c0', { outline: 3 });

  var hint = tutorialStep === 0 ? 'Press an ARROW KEY to continue   ·   SPACE to skip'
           : (tutorialStep === 1 ? 'Press SPACE to continue' : 'Press SPACE to play');
  ctx.save();
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(T * 4.5);
  text(hint, VW / 2, VH - 90, 26, '#ffffff', { outline: 5 });
  ctx.restore();
}

function drawPause() {
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,6,0.68)';
  ctx.fillRect(0, 0, VW, VH);
  ctx.restore();
  text('PAUSED', VW / 2, VH / 2 - 30, 78, '#ffd23f', { outline: 12 });
  ctx.save();
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(T * 4.5);
  text('Press ESC or SPACE to resume', VW / 2, VH / 2 + 48, 28, '#ffffff', { outline: 5 });
  ctx.restore();
}

function drawLeaderboard(x, y, w, h) {
  panel(x, y, w, h, 20, 'rgba(18,10,4,0.86)', 'rgba(255,210,63,0.55)', 4);
  text('LEADERBOARD', x + w / 2, y + 34, 26, '#ffd23f', { outline: 5 });

  var rows = Store.board();
  if (!rows.length) {
    text('no scores yet', x + w / 2, y + h / 2, 20, '#9c9c9c', { outline: 3 });
    return;
  }
  var top = y + 70, step = 33;
  for (var i = 0; i < rows.length; i++) {
    var e = rows[i];
    var yy = top + i * step;
    var mine = (i === myRank);
    if (mine) {
      ctx.save();
      ctx.globalAlpha = 0.24 + 0.12 * Math.sin(T * 7);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.roundRect(x + 10, yy - 14, w - 20, 28, 8); ctx.fill();
      ctx.restore();
    }
    var col = mine ? '#ffd23f' : (i === 0 ? '#fff3dd' : '#dcd2c0');
    text(String(i + 1).padStart(2, '0'), x + 26, yy, 19, col, { align: 'left', outline: 3 });
    text(e.initials, x + 74, yy, 21, col, { align: 'left', outline: 3 });
    text(String(e.score), x + w - 96, yy, 21, col, { align: 'right', outline: 3 });
    text(fmtTime(e.time || 0), x + w - 20, yy, 17, mine ? '#ffe9a3' : '#a9d38f',
         { align: 'right', outline: 3 });
  }
}

function drawGameOver() {
  var titleY = 118;
  var pop = clamp(gameOverT / 0.45, 0, 1);

  ctx.save();
  ctx.translate(VW / 2, titleY);
  ctx.scale(easeOutBack(pop), easeOutBack(pop));
  text('GAME OVER', 0, 0, 76, '#ff6b6b', { outline: 12, outlineColor: '#2b0a0a' });
  ctx.restore();

  /* left: score + stats + initials */
  var lx = 210, ly = 178, lw = 470, lh = 452;
  panel(lx, ly, lw, lh, 22, 'rgba(18,10,4,0.86)', 'rgba(255,210,63,0.55)', 4);

  text('FINAL SCORE', lx + lw / 2, ly + 40, 22, '#cfe6c0', { outline: 4 });
  text(String(Math.round(displayScore)), lx + lw / 2, ly + 96, 66,
       newHigh ? '#ffd23f' : '#ffffff', { outline: 10 });

  if (newHigh) {
    ctx.save();
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(T * 7);
    text('★ NEW HIGH SCORE! ★', lx + lw / 2, ly + 148, 27, '#ffd23f', { outline: 5 });
    ctx.restore();
  } else {
    text('BEST  ' + Store.highScore(), lx + lw / 2, ly + 148, 22, '#9fe8ff', { outline: 4 });
  }

  var rowY = ly + 200, step = 34;
  var statRows = [
    ['SURVIVED', fmtTime(Math.round(elapsed * 10) / 10)],
    ['HAMMERS DODGED', String(stats.dodged)],
    ['CLOSE CALLS', String(stats.closeCalls)],
    ['LONGEST COMBO', stats.longestCombo > 0 ? 'x' + stats.longestCombo : '—']
  ];
  for (var i = 0; i < statRows.length; i++) {
    text(statRows[i][0], lx + 34, rowY + i * step, 20, '#cfe6c0', { align: 'left', outline: 3 });
    text(statRows[i][1], lx + lw - 34, rowY + i * step, 22, '#fff3dd', { align: 'right', outline: 3 });
  }

  /* initials entry */
  var iy = ly + lh - 78;
  if (gameOverPhase === 'name') {
    text('ENTER YOUR INITIALS', lx + lw / 2, iy - 42, 19, '#ffd23f', { outline: 3 });
    for (var s = 0; s < 3; s++) {
      var bx = lx + lw / 2 - 96 + s * 66;
      var sel = (s === initialSlot);
      panel(bx - 27, iy - 27, 54, 58, 10,
            sel ? 'rgba(255,210,63,0.22)' : 'rgba(255,255,255,0.08)',
            sel ? '#ffd23f' : 'rgba(255,255,255,0.35)', 3);
      text(initials[s], bx, iy + 1, 34, sel ? '#ffd23f' : '#fff3dd', { outline: 4 });
      if (sel) {
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(T * 8);
        text('▲', bx, iy - 44, 15, '#ffd23f', { outline: 0, shadow: false });
        text('▼', bx, iy + 46, 15, '#ffd23f', { outline: 0, shadow: false });
        ctx.restore();
      }
    }
    text('↑↓ letter   ←→ slot   ENTER to save', lx + lw / 2, iy + 66, 17,
         '#cfe6c0', { outline: 3 });
  } else if (gameOverPhase === 'done') {
    if (myRank >= 0) {
      text('SAVED AS  ' + initials + '  ·  RANK #' + (myRank + 1), lx + lw / 2, iy - 6, 22,
           '#9fe8ff', { outline: 4 });
    }
    ctx.save();
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(T * 4.5);
    text('PRESS  SPACE  TO RETRY', lx + lw / 2, iy + 44, 30, '#ffffff', { outline: 6 });
    ctx.restore();
    text('ESC for title screen', lx + lw / 2, iy + 82, 16, '#cfe6c0', { outline: 3 });
  } else {
    ctx.save();
    ctx.globalAlpha = 0.5;
    text('press SPACE to skip', lx + lw / 2, iy + 44, 20, '#ffffff', { outline: 4 });
    ctx.restore();
  }

  drawLeaderboard(700, 178, 370, 452);
}

/* ------------------------------------------------------------
   19. Frame composition & main loop
   ------------------------------------------------------------ */

function render() {
  frameReset();
  ctx.drawImage(bgCanvas, 0, 0);

  var sh = (state === S.PLAYING || state === S.TITLE || state === S.GAME_OVER)
    ? shakeOffset() : { x: 0, y: 0 };

  ctx.save();
  ctx.translate(sh.x, sh.y);
  drawArena();
  ctx.restore();

  drawScreenFx();

  if (state === S.PLAYING || state === S.PAUSED) {
    drawHUD();
    drawBanners();
  } else if (state === S.TITLE) {
    drawTitleScreen();
  } else if (state === S.TUTORIAL) {
    drawTutorial();
  } else if (state === S.GAME_OVER) {
    drawConfetti();
    drawGameOver();
  }

  if (state === S.PAUSED) drawPause();

  if (Sound.isMuted() && state !== S.TITLE) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    text('MUTED (M)', VW - 30, VH - 20, 15, '#ffffff', { align: 'right', outline: 3 });
    ctx.restore();
  }
}

var lastTime = 0;
function frame(ts) {
  if (!lastTime) lastTime = ts;
  var dt = (ts - lastTime) / 1000;
  lastTime = ts;
  if (dt > 0.05) dt = 0.05;         /* never let logic explode after a stall */
  if (dt < 0) dt = 0;

  update(dt);
  render();
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------
   20. Boot
   ------------------------------------------------------------ */

buildGrid();
buildBackground();
resize();
Sound.setMuted(Store.muted());
firstSession = !Store.tutorialSeen();
goTitle();
requestAnimationFrame(frame);

/* Small hook for automated testing / debugging. */
window.__game = {
  get state() { return state; },
  get score() { return score; },
  get lives() { return lives; },
  get elapsed() { return elapsed; },
  get mole() { return mole; },
  get hammers() { return hammers; },
  get wild() { return wild; },
  get stats() { return stats; },
  get blocked() { return blocked; },
  get frenzy() { return frenzy; },
  get golden() { return golden; },
  get quake() { return quake; },
  get decoy() { return decoy; },
  get pickup() { return pickup; },
  get comboTier() { return comboTier; },
  get timeScale() { return timeScale; },
  get menuIndex() { return menuIndex; },
  get heldDirs() { return heldDirs.slice(); },
  get autopilot() { return autopilot; },
  slowMo: function (m, d) { slowMo(m, d); },
  moleCell: function () { return moleCell(); },
  difficulty: function () { return difficulty(); },
  setMole: function (c, r, st) {
    mole.col = c; mole.row = r;
    if (st) { mole.state = st; mole.tState = 0; if (st === 'under') mole.under = UNDER_TIME; }
    mole.invuln = 0; mole.stun = 0; mole.moveCd = 0; mole.popAnim = 0;
  },
  clearInvuln: function () { mole.invuln = 0; mole.stun = 0; mole.dazed = 0; },
  clearBlocked: function () { for (var i = 0; i < NCELLS; i++) blocked[i] = 0; },
  clearWildcard: function () { endWildcard(); frenzy = 0; golden = 0; quake = 0; decoy = null; pickup = null; wildTimer = 9999; },
  freezeWildcards: function () { wildTimer = 999999; },
  setSpawn: function (v) { spawnTimer = v; },
  holePos: function () { return holePos; },
  setState: function (s) { state = s; },
  startGame: startGame,
  goTitle: goTitle,
  forceWildcard: function (id) {
    var saved = WILDCARDS.slice();
    var def = wildcardDef(id);
    if (!def) return false;
    if (wild) { endWildcard(); }
    /* temporarily bias the pool to the requested wildcard */
    WILDCARDS.length = 0;
    WILDCARDS.push(def);
    startWildcard();
    WILDCARDS.length = 0;
    for (var i = 0; i < saved.length; i++) WILDCARDS.push(saved[i]);
    return true;
  },
  setElapsed: function (v) { elapsed = v; },
  spawnHammerAt: function (cell, warn) { spawnHammer(cell, warn === undefined ? 1 : warn, 0); },
  clearHammers: function () { hammers.length = 0; },
  killMole: function () { lives = 1; hitMole(); },
  setLives: function (n) { lives = n; },
  clearStorage: function () { Store.clearAll(); }
};

})();
