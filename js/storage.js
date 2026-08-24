/* ============================================================
   storage.js — localStorage-backed leaderboard & preferences
   ============================================================ */
'use strict';

var Store = (function () {
  var KEY_BOARD = 'unhammered.leaderboard.v1';
  var KEY_TUTORIAL = 'unhammered.tutorialSeen.v1';
  var KEY_MUTED = 'unhammered.muted.v1';
  var MAX_ENTRIES = 10;

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* private mode / quota — the game still plays, scores just don't persist */
    }
  }

  function board() {
    var b = read(KEY_BOARD, []);
    if (!Array.isArray(b)) return [];
    return b.filter(function (e) {
      return e && typeof e.score === 'number';
    }).slice(0, MAX_ENTRIES);
  }

  function highScore() {
    var b = board();
    return b.length ? b[0].score : 0;
  }

  function qualifies(score) {
    if (score <= 0) return false;
    var b = board();
    return b.length < MAX_ENTRIES || score > b[b.length - 1].score;
  }

  /* Returns the rank (0-based) the entry landed at, or -1 if it fell off. */
  function submit(entry) {
    var b = board();
    b.push(entry);
    b.sort(function (a, c) {
      return c.score - a.score || c.time - a.time;
    });
    var trimmed = b.slice(0, MAX_ENTRIES);
    write(KEY_BOARD, trimmed);
    return trimmed.indexOf(entry);
  }

  return {
    board: board,
    highScore: highScore,
    qualifies: qualifies,
    submit: submit,
    tutorialSeen: function () { return read(KEY_TUTORIAL, false) === true; },
    setTutorialSeen: function () { write(KEY_TUTORIAL, true); },
    muted: function () { return read(KEY_MUTED, false) === true; },
    setMuted: function (m) { write(KEY_MUTED, !!m); },
    clearAll: function () {
      try {
        localStorage.removeItem(KEY_BOARD);
        localStorage.removeItem(KEY_TUTORIAL);
        localStorage.removeItem(KEY_MUTED);
      } catch (e) {}
    }
  };
})();
