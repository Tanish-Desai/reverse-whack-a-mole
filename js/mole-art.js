/* ============================================================
   UNHAMMERED — Mole art
   Pure drawing routines for the player mole.

   Shared by the game (browser global `MoleArt`) and the offline
   sprite harness in tools/sprites (CommonJS require). No game
   state, no DOM, no timers — every input arrives as an argument
   so the same code renders identically headlessly.
   ============================================================ */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MoleArt = factory();
})(typeof self !== 'undefined' ? self : this, function () {

var FUR = { dark: '#6b4526', mid: '#8a5c33', light: '#a9743f', belly: '#d8b184' };

/* The mole's full vertical travel from underground to fully up.
   drawMoleAt maps rise 0..1 across this distance. */
var RISE_TRAVEL = 76;

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}
function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}
function star(ctx, x, y, r1, r2, points, rot) {
  ctx.beginPath();
  for (var i = 0; i < points * 2; i++) {
    var a = rot + (i * Math.PI) / points;
    var r = i % 2 ? r2 : r1;
    var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/* Body, drawn centred on the current transform origin. */
function drawMoleBody(ctx, o) {
  var fur = FUR;
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
  ellipse(ctx, 0, 0, 42, 46); ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = o.gold ? 'rgba(120,80,0,0.75)' : 'rgba(46,28,12,0.8)';
  ctx.stroke();
  ctx.shadowBlur = 0;

  /* ears */
  ctx.fillStyle = o.gold ? '#e8ae1f' : fur.dark;
  circle(ctx, -30, -30, 12); ctx.fill();
  circle(ctx, 30, -30, 12); ctx.fill();
  ctx.fillStyle = o.gold ? '#ffe9a3' : '#c98f66';
  circle(ctx, -30, -30, 6); ctx.fill();
  circle(ctx, 30, -30, 6); ctx.fill();

  /* muzzle */
  ctx.fillStyle = o.gold ? '#fff3c9' : fur.belly;
  ellipse(ctx, 0, 16, 28, 21); ctx.fill();
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
    circle(ctx, -ex, ey, 10); ctx.fill();
    circle(ctx, ex, ey, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(46,28,12,0.55)';
    ctx.lineWidth = 2;
    circle(ctx, -ex, ey, 10); ctx.stroke();
    circle(ctx, ex, ey, 10); ctx.stroke();
    var lookX = (o.facing || 1) * 2.4;
    ctx.fillStyle = '#1b1109';
    circle(ctx, -ex + lookX, ey + 1, 5.4); ctx.fill();
    circle(ctx, ex + lookX, ey + 1, 5.4); ctx.fill();
    ctx.fillStyle = '#fff';
    circle(ctx, -ex + lookX + 2, ey - 2.5, 2.1); ctx.fill();
    circle(ctx, ex + lookX + 2, ey - 2.5, 2.1); ctx.fill();
  }

  /* nose */
  ctx.fillStyle = '#ff8fa8';
  ellipse(ctx, 0, 8, 8, 6.5); ctx.fill();
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
  ellipse(ctx, -26, 40, 13, 9); ctx.fill();
  ellipse(ctx, 26, 40, 13, 9); ctx.fill();
  ctx.strokeStyle = 'rgba(46,28,12,0.5)';
  ctx.lineWidth = 2.5;
  ellipse(ctx, -26, 40, 13, 9); ctx.stroke();
  ellipse(ctx, 26, 40, 13, 9); ctx.stroke();
  ctx.strokeStyle = '#f4e0c0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (var c = -1; c <= 1; c++) {
    ctx.moveTo(-26 + c * 5, 44); ctx.lineTo(-26 + c * 5, 48);
    ctx.moveTo(26 + c * 5, 44); ctx.lineTo(26 + c * 5, 48);
  }
  ctx.stroke();

  ctx.restore();
}

/* `t` drives the orbit phase; the game passes its global clock. */
function drawDazeStars(ctx, x, y, count, speed, t) {
  for (var i = 0; i < count; i++) {
    var a = t * speed + (i / count) * Math.PI * 2;
    var sx = x + Math.cos(a) * 40;
    var sy = y + Math.sin(a) * 13;
    ctx.save();
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(a * 2);
    ctx.fillStyle = '#ffe066';
    star(ctx, sx, sy, 9, 4, 5, a * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,0,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

/* rise: 0 = fully underground, 1 = fully up.
   (x, y) is the hole centre. o.shadow=false suppresses the contact
   shadow, which the sprite harness does not want baked in. */
function drawMoleAt(ctx, x, y, rise, o) {
  o = o || {};
  var cy = y + 34 - RISE_TRAVEL * rise;

  ctx.save();
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;

  /* contact shadow */
  if (o.shadow !== false) {
    ctx.save();
    ctx.globalAlpha *= 0.3 * rise;
    ctx.fillStyle = '#000';
    ellipse(ctx, x, y + 2, 38, 14); ctx.fill();
    ctx.restore();
  }

  ctx.translate(x, cy);
  drawMoleBody(ctx, {
    sx: o.sx === undefined ? 1 : o.sx,
    sy: o.sy === undefined ? 1 : o.sy,
    gold: o.gold, dazed: o.dazed,
    closedEyes: o.closedEyes, facing: o.facing
  });
  ctx.restore();

  if (o.dazed) drawDazeStars(ctx, x, cy - 62, 3, 4.2, o.t || 0);
}

return {
  FUR: FUR,
  RISE_TRAVEL: RISE_TRAVEL,
  drawMoleBody: drawMoleBody,
  drawDazeStars: drawDazeStars,
  drawMoleAt: drawMoleAt
};

});
