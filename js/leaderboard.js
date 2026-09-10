/* ============================================================
   leaderboard.js — the shared board, with the local one as fallback

   Wraps Store (localStorage) and the /api/scores function behind one
   façade. Reads are synchronous because the renderer runs every frame:
   whatever the last successful fetch returned is what gets drawn, and
   the local board stands in until — or instead of — that arrives.
   ============================================================ */
'use strict';

var Board = (function () {
  var ENDPOINT = '/api/scores';
  var SHOW = 10;
  var GET_TIMEOUT = 6000;
  var POST_TIMEOUT = 8000;
  /* The title screen refetches on every visit; this stops a player who is
     bouncing off the menu from re-requesting several times a second. */
  var MIN_REFRESH_GAP = 15000;

  var globalRows = null;      /* null until a fetch has succeeded at least once */
  var globalTotal = 0;
  var status = 'idle';        /* idle | loading | online | offline */
  var lastFetch = 0;
  var inFlight = false;

  function supported() {
    return typeof fetch === 'function' && typeof AbortController === 'function';
  }

  /* fetch() only rejects on a network failure, and a game that hangs on a
     dead endpoint is worse than one with no global board — so every call
     is bounded and every non-2xx is treated as offline. */
  function request(url, options, timeout) {
    return new Promise(function (resolve, reject) {
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, timeout);
      var opts = options || {};
      opts.signal = ctrl.signal;

      fetch(url, opts).then(function (res) {
        clearTimeout(timer);
        if (!res.ok) { reject(new Error('HTTP ' + res.status)); return; }
        resolve(res.json());
      }).catch(function (err) {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  function adopt(payload) {
    if (!payload || !Array.isArray(payload.entries)) return false;
    globalRows = payload.entries.filter(function (e) {
      return e && typeof e.score === 'number';
    });
    globalTotal = typeof payload.total === 'number' ? payload.total : globalRows.length;
    status = 'online';
    return true;
  }

  function goOffline() {
    status = 'offline';
    /* Rows from an earlier successful fetch are kept: a stale global board
       is still truer than this browser's own ten scores. */
  }

  /* Fire-and-forget. Returns a promise for the tests; nothing in the game
     waits on it. */
  function refresh(force) {
    var now = Date.now();
    if (!supported()) { status = 'offline'; return Promise.resolve(false); }
    if (inFlight) return Promise.resolve(false);
    if (!force && now - lastFetch < MIN_REFRESH_GAP) return Promise.resolve(false);

    inFlight = true;
    lastFetch = now;
    if (status !== 'online') status = 'loading';

    return request(ENDPOINT + '?limit=' + SHOW, { method: 'GET' }, GET_TIMEOUT)
      .then(function (payload) {
        inFlight = false;
        return adopt(payload);
      })
      .catch(function () {
        inFlight = false;
        goOffline();
        return false;
      });
  }

  /* The rows the leaderboard panel should draw right now. */
  function rows() {
    return globalRows && globalRows.length ? globalRows : Store.board();
  }

  function isGlobal() {
    return !!(globalRows && globalRows.length);
  }

  /* A run is worth naming if it would land on either board — the global one
     fills up with strangers, so a personal best still earns the prompt. */
  function qualifies(score) {
    if (Store.qualifies(score)) return true;
    if (!globalRows) return false;
    if (globalRows.length < SHOW) return score > 0;
    return score > globalRows[globalRows.length - 1].score;
  }

  /* Files the run locally straight away, then tries the shared board.
     `done(rank, global)` runs once, with the global rank when the POST
     landed and the local one when it didn't. */
  function submit(entry, done) {
    var localRank = Store.submit(entry);
    var finished = false;

    function finish(rank, global) {
      if (finished) return;
      finished = true;
      if (typeof done === 'function') done(rank, global);
    }

    if (!supported()) { status = 'offline'; finish(localRank, false); return; }

    status = 'saving';
    request(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        team: entry.team,
        player: entry.player,
        score: entry.score,
        time: entry.time
      })
    }, POST_TIMEOUT).then(function (payload) {
      /* The POST response is the freshly ranked board, so there is no need
         to follow it with a GET. */
      if (adopt(payload)) {
        lastFetch = Date.now();
        finish(typeof payload.rank === 'number' ? payload.rank : -1, true);
      } else {
        goOffline();
        finish(localRank, false);
      }
    }).catch(function () {
      goOffline();
      finish(localRank, false);
    });
  }

  return {
    refresh: refresh,
    rows: rows,
    isGlobal: isGlobal,
    qualifies: qualifies,
    submit: submit,
    total: function () { return globalTotal; },
    status: function () { return status; }
  };
})();
