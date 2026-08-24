/* Measures, per difficulty band: average live hammers, peak, spawn rate.
   Sampling runs inside requestAnimationFrame so throttling can't corrupt it. */
(function () {
  var G = window.__game;

  function sampleBand(t, frames) {
    return new Promise(function (resolve) {
      G.startGame();
      G.freezeWildcards();
      G.clearHammers();
      G.setElapsed(t);
      G.setMole(1, 1, 'under');

      var warmup = 90, n = 0, sum = 0, peak = 0;
      var seen = new Set(), created = 0, gameSeconds = 0, lastTs = 0;

      function step(ts) {
        G.setElapsed(t);
        G.setMole(1, 1, 'under');
        var hs = G.hammers;
        for (var i = 0; i < hs.length; i++) {
          if (!seen.has(hs[i])) { seen.add(hs[i]); if (warmup <= 0) created++; }
        }
        if (warmup-- > 0) { lastTs = ts; requestAnimationFrame(step); return; }
        gameSeconds += Math.min(0.05, (ts - lastTs) / 1000);
        lastTs = ts;
        var live = 0;
        for (i = 0; i < hs.length; i++) {
          var ph = hs[i].phase;
          if (ph === 'warn' || ph === 'strike') live++;
        }
        sum += live; peak = Math.max(peak, live); n++;
        if (n < frames) requestAnimationFrame(step);
        else {
          var d = G.difficulty();
          resolve({
            t: t,
            spec: d.minA + '-' + d.maxA + ' every ' + d.gap + 's',
            avgLive: +(sum / n).toFixed(2),
            peakLive: peak,
            hammersPerSec: +(created / gameSeconds).toFixed(2),
            expectedAvg: +((created / gameSeconds) * (d.warn + 0.3)).toFixed(2),
            seconds: +gameSeconds.toFixed(1)
          });
        }
      }
      requestAnimationFrame(step);
    });
  }

  window.measureIntensity = async function () {
    var bands = [5, 20, 37, 52, 80];
    var out = [];
    for (var b = 0; b < bands.length; b++) out.push(await sampleBand(bands[b], 2400));
    G.startGame();
    return out;
  };
  return 'intensity loaded';
})();
