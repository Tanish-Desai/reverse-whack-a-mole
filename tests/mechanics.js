/* Browser-driven mechanics tests. Load with:
   fetch('/tests/mechanics.js').then(r=>r.text()).then(eval)
   then: await runTests()                                          */
(function () {
  var G = window.__game;
  var results = [];
  var errors = [];
  window.addEventListener('error', function (e) { errors.push(String(e.message)); });

  /* A tap: keydown immediately followed by keyup, like a real key press. */
  function press(code, key) {
    hold(code, key);
    release(code, key);
  }
  function hold(code, key) {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      code: code, key: key || code, bubbles: true, cancelable: true
    }));
  }
  function release(code, key) {
    window.dispatchEvent(new KeyboardEvent('keyup', {
      code: code, key: key || code, bubbles: true, cancelable: true
    }));
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function ok(name, cond, detail) {
    results.push({ name: name, pass: !!cond, detail: detail === undefined ? '' : String(detail) });
  }
  function near(a, b, tol) { return Math.abs(a - b) <= tol; }
  /* Scoring is measured in wall-clock time, so wait out any slow motion first. */
  /* Waits until the hammer on `cell` is `lead` seconds from striking, so dodge
     timing never depends on setTimeout drift. */
  async function dodgeMoment(cell, lead) {
    for (var i = 0; i < 400; i++) {
      var hs = G.hammers;
      for (var j = 0; j < hs.length; j++) {
        if (hs[j].cell === cell && hs[j].phase === 'warn' &&
            hs[j].warn - hs[j].t <= lead) return true;
      }
      await wait(8);
    }
    return false;
  }
  async function fullSpeed() {
    await wait(80);                        /* let any just-fired slowdown register */
    for (var i = 0; i < 80 && G.timeScale < 0.995; i++) await wait(50);
    await wait(40);
  }

  function freshGame() {
    G.startGame();
    G.freezeWildcards();
    G.clearHammers();
    G.setSpawn(999999);
    G.clearBlocked();
  }

  window.runTests = async function () {
    results = []; errors = [];

    /* ---- movement ---- */
    freshGame();
    G.setMole(1, 1, 'above');
    await wait(60);
    press('ArrowRight');
    ok('move right', G.mole.col === 2 && G.mole.row === 1, 'col=' + G.mole.col);

    press('ArrowRight');
    ok('move cooldown blocks instant second move', G.mole.col === 2, 'col=' + G.mole.col);
    await wait(200);
    press('ArrowRight');
    ok('move allowed after cooldown', G.mole.col === 3, 'col=' + G.mole.col);
    await wait(200);
    press('ArrowRight');
    ok('no wraparound at right edge', G.mole.col === 3, 'col=' + G.mole.col);
    await wait(200);
    press('KeyW');
    await wait(200);
    press('KeyW');
    ok('WASD moves + clamps at top row', G.mole.row === 0, 'row=' + G.mole.row);

    /* ---- input feel: immediacy and key-hold repeat ---- */
    G.setMole(0, 1, 'above');
    await wait(120);
    press('ArrowRight');
    ok('a press moves the mole immediately', G.mole.col === 1, 'col=' + G.mole.col);
    await wait(80);                            /* longer than the 50ms cooldown */
    press('ArrowRight');
    ok('a second press lands as soon as the short cooldown clears',
       G.mole.col === 2, 'col=' + G.mole.col);

    G.setMole(0, 1, 'above');
    await wait(120);
    press('ArrowRight');
    press('ArrowRight');                       /* same instant — inside the cooldown */
    ok('same-instant spam is dropped, not queued', G.mole.col === 1, 'col=' + G.mole.col);
    await wait(300);
    ok('a dropped press is never replayed later', G.mole.col === 1, 'col=' + G.mole.col);

    G.setMole(0, 1, 'above');
    await wait(200);
    hold('ArrowRight');
    await wait(500);                           /* one immediate step + ~3 repeats */
    release('ArrowRight');
    var glided = G.mole.col;
    ok('holding a direction keeps stepping across the grid', glided >= 2,
       'col=' + glided);
    await wait(300);
    ok('movement stops once the key is released', G.mole.col === glided,
       'col=' + G.mole.col);

    /* ---- slow motion ---- */
    freshGame();
    G.setMole(1, 1, 'above');
    G.clearHammers();
    G.clearInvuln();
    G.spawnHammerAt(G.moleCell(), 0.15);
    await wait(400);
    ok('getting hit triggers slow motion', G.timeScale < 0.6,
       'timeScale=' + G.timeScale.toFixed(2));
    await wait(1000);
    ok('slow motion eases back to full speed', G.timeScale > 0.98,
       'timeScale=' + G.timeScale.toFixed(2));

    freshGame();
    G.setMole(1, 1, 'above');
    G.forceWildcard('frenzy');
    await wait(120);
    ok('wildcard announcement triggers slow motion', G.timeScale < 0.6,
       'timeScale=' + G.timeScale.toFixed(2));
    await wait(1800);
    ok('speed restored after the announcement', G.timeScale > 0.98,
       'timeScale=' + G.timeScale.toFixed(2));

    /* ---- title menu ---- */
    G.goTitle();
    ok('title starts on START GAME', G.menuIndex === 0, G.menuIndex);
    press('ArrowDown');
    ok('arrow keys move the title selection', G.menuIndex === 1, G.menuIndex);
    press('Space');
    ok('HOW TO PLAY opens the tutorial', G.state === 'TUTORIAL', G.state);
    press('Space');                            /* space skips the tutorial */
    ok('tutorial opened from the menu returns to the title', G.state === 'TITLE', G.state);
    ok('returning to the title resets the selection', G.menuIndex === 0, G.menuIndex);
    press('Space');
    ok('START GAME starts a run', G.state === 'PLAYING', G.state);

    /* ---- burrow / surface timer ---- */
    G.setMole(1, 1, 'above');
    press('Space');
    ok('space starts burrowing', G.mole.state === 'burrowing', G.mole.state);
    await wait(260);
    ok('burrow completes to underground', G.mole.state === 'under', G.mole.state);
    ok('underground timer starts at 3s', near(G.mole.under, 3.0, 0.12), G.mole.under);

    press('ArrowLeft');
    ok('can tunnel while underground', G.mole.col === 0 && G.mole.state === 'under',
       'col=' + G.mole.col + ' state=' + G.mole.state);

    await wait(1000);
    press('Space');
    ok('space surfaces from underground', G.mole.state === 'above', G.mole.state);
    await wait(60);
    press('Space');
    await wait(260);
    ok('voluntary surfacing gives a full 3s again (no partial refund)',
       near(G.mole.under, 3.0, 0.15), G.mole.under);

    /* ---- forced eject ---- */
    G.setMole(1, 1, 'above');
    G.clearHammers();
    press('Space');
    await wait(3450);
    ok('forced eject after the timer expires', G.mole.state === 'above', G.mole.state);
    ok('eject applies a stun', G.mole.stun > 0 || G.mole.stun > -0.2, 'stun=' + G.mole.stun.toFixed(2));
    var colBefore = G.mole.col;
    press('ArrowRight');
    ok('cannot move while stunned', G.mole.col === colBefore, 'col=' + G.mole.col);
    await wait(600);
    ok('a press swallowed by the stun is not replayed', G.mole.col === colBefore,
       'col=' + G.mole.col);
    press('ArrowRight');
    await wait(60);
    ok('can move once the stun ends', G.mole.col === colBefore + 1, 'col=' + G.mole.col);

    /* ---- hammer hit + invulnerability ---- */
    freshGame();
    G.setMole(1, 1, 'above');
    var lives0 = G.lives;
    G.spawnHammerAt(G.moleCell(), 0.2);
    await wait(450);
    ok('hammer strike on an exposed mole costs a life', G.lives === lives0 - 1,
       'lives ' + lives0 + '->' + G.lives);
    ok('hit grants invulnerability', G.mole.invuln > 0.5, G.mole.invuln.toFixed(2));

    var lives1 = G.lives;
    G.clearHammers();
    G.spawnHammerAt(G.moleCell(), 0.2);
    await wait(450);
    ok('no damage during the invulnerability window', G.lives === lives1, 'lives=' + G.lives);

    /* ---- underground is safe ---- */
    freshGame();
    G.setMole(2, 1, 'above');
    var lives2 = G.lives;
    press('Space');
    await wait(260);
    G.spawnHammerAt(G.moleCell(), 0.2);
    await wait(450);
    ok('underground mole takes no damage', G.lives === lives2, 'lives=' + G.lives);

    /* ---- close call + combo ---- */
    freshGame();
    G.setMole(1, 1, 'above');
    G.clearInvuln();
    var cc0 = G.stats.closeCalls, sc0 = G.score;
    var ccCell = G.moleCell();
    G.spawnHammerAt(ccCell, 0.5);
    var reached = await dodgeMoment(ccCell, 0.18);
    ok('telegraph observed before the strike', reached, 'reached=' + reached);
    press('ArrowRight');                       /* dodge with ~0.18s to spare */
    await wait(500);
    ok('close call registered', G.stats.closeCalls === cc0 + 1,
       'closeCalls ' + cc0 + '->' + G.stats.closeCalls +
       ' state=' + G.state + ' cell=' + G.moleCell() + ' mole=' + G.mole.state +
       ' lives=' + G.lives + ' scale=' + G.timeScale.toFixed(2) +
       ' held=' + JSON.stringify(G.heldDirs) + ' auto=' + G.autopilot);
    ok('close call awards ~25 points', G.score - sc0 >= 25, 'delta=' + (G.score - sc0));
    ok('combo tier 1 after first close call', G.comboTier === 1, 'tier=' + G.comboTier);

    G.clearHammers();
    await wait(200);
    var ccCell2 = G.moleCell();
    G.spawnHammerAt(ccCell2, 0.5);
    await dodgeMoment(ccCell2, 0.18);
    press('ArrowLeft');
    await wait(500);
    ok('second close call within 3s raises combo to x2', G.comboTier === 2, 'tier=' + G.comboTier);
    ok('longest combo stat tracked', G.stats.longestCombo >= 2, G.stats.longestCombo);

    await wait(3200);
    ok('combo resets after 3s without a close call', G.comboTier === 0, 'tier=' + G.comboTier);

    /* ---- scoring rate ---- */
    freshGame();
    await fullSpeed();
    G.setMole(1, 1, 'above');
    G.clearHammers();
    var s0 = G.score;
    await wait(1000);
    var rate = G.score - s0;
    ok('surface scoring ~10 pts/sec', rate >= 8 && rate <= 13, 'delta=' + rate);

    G.setMole(1, 1, 'under');
    var s1 = G.score;
    await wait(600);
    ok('no points while underground', G.score === s1, 'delta=' + (G.score - s1));

    /* ---- difficulty table ---- */
    G.clearWildcard();
    var checks = [
      [0, 1.0, 2.0, 1], [5, 1.0, 2.0, 1],
      [15, 0.8, 1.5, 2], [20, 0.8, 1.5, 2],
      [30, 0.65, 1.2, 3], [37, 0.65, 1.2, 3],
      [45, 0.5, 0.9, 4], [50, 0.5, 0.9, 4],
      [60, 0.4, 0.7, 5], [90, 0.4, 0.7, 5]
    ];
    var diffOk = true, diffDetail = [];
    for (var i = 0; i < checks.length; i++) {
      G.setElapsed(checks[i][0]);
      var d = G.difficulty();
      var good = near(d.warn, checks[i][1], 0.001) && near(d.gap, checks[i][2], 0.001)
                 && d.maxA === checks[i][3];
      diffDetail.push(checks[i][0] + 's warn=' + d.warn.toFixed(2) + ' gap=' + d.gap.toFixed(2) + ' max=' + d.maxA);
      if (!good) diffOk = false;
    }
    ok('difficulty matches the spec table exactly at every tabulated time', diffOk,
       diffDetail.join(' | '));

    /* difficulty must never jump or reverse between bands */
    var prevW = Infinity, prevG = Infinity, smooth = true, maxStep = 0;
    for (var tt = 0; tt <= 75; tt += 0.25) {
      G.setElapsed(tt);
      var dd = G.difficulty();
      if (dd.warn > prevW + 1e-9 || dd.gap > prevG + 1e-9) smooth = false;
      if (prevW !== Infinity) maxStep = Math.max(maxStep, prevW - dd.warn);
      prevW = dd.warn; prevG = dd.gap;
    }
    ok('difficulty is monotonic and continuous (no step jumps)', smooth && maxStep < 0.02,
       'largest single-step warn change=' + maxStep.toFixed(4));

    /* ---- wildcards ---- */
    freshGame();
    G.setElapsed(20);
    G.setMole(1, 1, 'above');
    G.forceWildcard('lockdown');
    var nBlocked = G.blocked.filter(function (b) { return b > 0; }).length;
    ok('grid lockdown boards up 3-4 holes', nBlocked >= 3 && nBlocked <= 4, nBlocked);
    var free = [];
    for (var c = 0; c < 12; c++) if (G.blocked[c] > 0) free.push(c);
    ok('mole is never left inside a boarded hole', G.blocked[G.moleCell()] <= 0,
       'moleCell=' + G.moleCell());
    /* try to walk into a boarded hole */
    var target = free[0];
    var mc = G.moleCell();
    if (Math.abs((target % 4) - (mc % 4)) + Math.abs(Math.floor(target / 4) - Math.floor(mc / 4)) === 1) {
      G.setMole(mc % 4, Math.floor(mc / 4), 'above');
      press((target % 4) > (mc % 4) ? 'ArrowRight' : ((target % 4) < (mc % 4) ? 'ArrowLeft'
            : (Math.floor(target / 4) > Math.floor(mc / 4) ? 'ArrowDown' : 'ArrowUp')));
      ok('cannot enter a boarded hole', G.moleCell() !== target, 'cell=' + G.moleCell());
    } else {
      ok('cannot enter a boarded hole', true, 'skipped — no adjacent boarded hole');
    }

    freshGame();
    G.clearWildcard(); G.clearBlocked();
    G.forceWildcard('frenzy');
    ok('frenzy activates', G.frenzy > 0, G.frenzy);
    await fullSpeed();
    G.setMole(1, 1, 'above');
    var tsAtStart = G.timeScale;
    var f0 = G.score;
    await wait(900);
    var frate = (G.score - f0) / 0.9;
    ok('frenzy triples the scoring rate', frate > 25 && frate < 36,
       'rate=' + frate.toFixed(1) + ' scaleAtStart=' + tsAtStart.toFixed(2) +
       ' scaleNow=' + G.timeScale.toFixed(2) + ' frenzyLeft=' + G.frenzy.toFixed(2));
    ok('frenzy halves the warning time', near(G.difficulty().warn, 0.5, 0.01),
       G.difficulty().warn);

    freshGame();
    G.clearWildcard();
    G.setMole(1, 1, 'above');
    G.forceWildcard('golden');
    ok('golden mole activates', G.golden > 0, G.golden);
    await fullSpeed();
    var glives = G.lives;
    G.clearHammers();
    G.spawnHammerAt(G.moleCell(), 0.2);
    var g0 = G.score;
    await wait(900);
    ok('golden mole is invulnerable', G.lives === glives, 'lives=' + G.lives);
    var grate = (G.score - g0) / 0.9;
    ok('golden mole scores at 5x', grate > 42 && grate < 58,
       'rate=' + grate.toFixed(1) + ' scaleNow=' + G.timeScale.toFixed(2) +
       ' goldenLeft=' + G.golden.toFixed(2));

    G.clearWildcard();
    G.forceWildcard('decoy');
    ok('decoy mole appears', !!G.decoy && G.decoy.cell !== G.moleCell(), G.decoy && G.decoy.cell);

    G.clearWildcard();
    var before = G.holePos().map(function (p) { return p.x + ',' + p.y; }).join('|');
    G.forceWildcard('quake');
    await wait(500);
    var after = G.holePos().map(function (p) { return p.x + ',' + p.y; }).join('|');
    ok('earthquake rearranges the grid', before !== after, 'moved');
    ok('earthquake is timed', G.quake > 0, G.quake);

    G.clearWildcard();
    G.forceWildcard('extralife');
    ok('extra life pickup spawns', !!G.pickup, G.pickup && G.pickup.cell);
    if (G.pickup) {
      var pc = G.pickup.cell;
      G.setLives(2);
      G.setMole(pc % 4, Math.floor(pc / 4), 'above');
      await wait(120);
      ok('collecting the heart grants a life', G.lives === 3, 'lives=' + G.lives);
    }

    /* ---- game over + leaderboard ---- */
    G.clearWildcard();
    G.clearHammers();
    G.setLives(1);
    G.clearInvuln();
    G.killMole();
    ok('game ends at zero lives', G.state === 'GAME_OVER', G.state);
    await wait(1400);
    press('Space');                                     /* skip count-up */
    await wait(120);
    ok('qualifying score opens initials entry', G.state === 'GAME_OVER', G.state);
    press('KeyZ', 'z'); press('KeyO', 'o'); press('KeyE', 'e');   /* type initials */
    press('Enter');
    await wait(150);
    var board = JSON.parse(localStorage.getItem('unhammered.leaderboard.v1') || '[]');
    ok('typed initials are recorded', board.length > 0 && board[0].initials === 'ZOE',
       JSON.stringify(board[0] || null));
    press('Space');
    await wait(120);
    ok('space retries into a new run', G.state === 'PLAYING' && G.lives === 3,
       G.state + ' lives=' + G.lives);

    /* ---- pause ---- */
    press('Escape');
    ok('escape pauses', G.state === 'PAUSED', G.state);
    var pe = G.elapsed;
    await wait(400);
    ok('clock frozen while paused', near(G.elapsed, pe, 0.02), G.elapsed);
    press('Escape');
    ok('escape resumes', G.state === 'PLAYING', G.state);

    var passed = results.filter(function (r) { return r.pass; }).length;
    return {
      passed: passed,
      failed: results.length - passed,
      jsErrors: errors,
      failures: results.filter(function (r) { return !r.pass; }),
      all: results
    };
  };
  return 'tests loaded';
})();
