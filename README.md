# UNHAMMERED — Reverse Whack-a-Mole

You are the mole. Hammers slam down from above. Score by staying exposed,
survive by hiding — but you can never hide for long.

Built from `reverse-whack-a-mole-spec.md`. Vanilla JS + HTML5 Canvas,
zero dependencies, no build step.

## Play

Open `index.html` directly in a browser — no server needed.

Or serve it (useful for the test suite, which fetches from `/tests/`):

```bash
python3 -m http.server 8123
```

## Controls

| Input | Action |
|---|---|
| Arrow keys / WASD | Move one hole (one press, one step) |
| Space | Burrow / surface, and confirm on menus |
| Up / Down | Choose a title menu item |
| Enter | Confirm (menus, initials) |
| Esc | Pause |
| M | Mute |

## Files

```
index.html        shell + canvas
css/style.css     letterboxed full-screen layout
js/game.js        game loop, state machine, rendering
js/audio.js       synthesised SFX + chiptune loop (WebAudio, no asset files)
js/storage.js     localStorage leaderboard + preferences
tests/            browser-driven test suites
```

## What's implemented

Everything in the spec's Must-Have, Should-Have and Nice-to-Have lists:
4x3 grid, three mole states, 3s surface timer with forced eject, hammer
telegraph/strike/recovery, all seven targeting patterns, lives and damage,
passive + close-call + combo + milestone scoring, the continuous difficulty
ramp, five wildcards, title / tutorial / pause / game-over screens,
a top-10 localStorage leaderboard with arcade initials entry, particles,
screen shake, and synthesised audio.

## Feel notes

- **One press, one step.** The spec suggests a ~150ms move cooldown to stop
  spam-teleporting; that read as input lag, so the cooldown is down to 50ms —
  enough to keep a single frame from eating several moves, short enough to be
  imperceptible. Nothing is queued and nothing repeats: a press that lands
  inside the cooldown is dropped rather than replayed, and holding a direction
  moves exactly one hole. Tune `MOVE_CD_ABOVE` / `MOVE_CD_UNDER` at the top of
  `js/game.js`.
- **Slow motion** punctuates the dramatic beats. `slowMo(scale, duration)` drops
  the simulation to `scale` speed, holds for the first third, then eases back to
  full. Current triggers:

  | Event | Scale | Duration |
  |---|---|---|
  | Mole gets bonked | 0.22 | 0.75s |
  | Wildcard announcement | 0.30 | 1.5s |
  | Survival milestone | 0.45 | 0.9s |
  | Death | 0.18 | 1.1s |

  The UI clock, the banners and the score roll-up stay on real time, so an
  announcement never outstays its welcome just because the world slowed down.
  Music tempo sags with the slowdown, and a blue vignette closes in as a cue.
- **Announcements sit above the arena**, in the gap between the HUD bar and the
  top row of holes, so they never cover a hole you have to read — and the
  slowdown gives you time to take them in without the game running away.
- **Title menu** has START GAME and HOW TO PLAY. The latter runs the same
  three-step tutorial and returns to the menu; on a first-ever play the tutorial
  runs automatically and hands off straight into a run.

## Deviations from the spec

- **Earthquake was cut.** The spec's sixth wildcard scrambled hole positions
  while movement stayed grid-logical. It read as unintuitive rather than
  challenging, so it's gone along with the hole-animation layer that only
  existed to serve it — the grid is now static. The remaining five weights
  (25/15/20/15/15) are normalised against their own total, so no re-tuning was
  needed; each event just became proportionally more likely.

A few places where the spec left room, and what was chosen:

- **Difficulty ramp.** The spec asks for continuous scaling *and* gives a table
  of time bands. Each band holds its tabulated values through its first half,
  then eases into the next band's values over the second half — so every number
  in the table is what you actually get for most of that band, with no visible
  step changes. `tests/intensity.js` measures the result.
- **Hammer waves.** The "Hammers Active" column is treated as a target for how
  many hammers are *live at once*. Wave size is derived from that target, the
  spawn interval, and hammer lifetime, and filler hammers are staggered across
  the interval so late game reads as constant pressure rather than
  wall-then-silence. Row sweeps, column slams and crosses are exempt from the
  cap so a set piece is never cut off half way.
- **Surfacing.** Burrowing has its specified ~200ms invulnerable transition;
  popping back up is immediate, so tapping Space can't be used as an extra
  dodge on top of the burrow.
- **Underground movement** has a 100ms cooldown (the spec only specifies one
  for above-ground movement) purely to stop the position tell from jittering.
- **"Hammers dodged"** on the game-over screen counts strikes that landed on
  the mole's own hole without connecting, plus close calls.

## Tests

With the server running, in the browser console:

```js
fetch('/tests/mechanics.js').then(r => r.text()).then(eval)
await runTests()      // 67 assertions: movement and input response, timers,
                      // damage, scoring, difficulty, slow motion, the five
                      // wildcards, title menu, leaderboard, pause
```

```js
fetch('/tests/intensity.js').then(r => r.text()).then(eval)
await measureIntensity()   // average/peak live hammers per difficulty band
```

Both sample inside `requestAnimationFrame`, so a throttled background tab
stretches the wall clock rather than corrupting results. Dodge-timing tests
poll the hammer's actual telegraph progress instead of `setTimeout`, and
scoring-rate tests wait out any active slow motion first — otherwise both
measure wall-clock time against a simulation that isn't running at 1x.

`window.__game` exposes state getters and helpers (`forceWildcard`,
`setElapsed`, `spawnHammerAt`, ...) used by the suites.
