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
| Arrow keys / WASD | Move one hole |
| Space | Burrow / surface |
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
ramp, all six wildcards, title / tutorial / pause / game-over screens,
a top-10 localStorage leaderboard with arcade initials entry, particles,
screen shake, and synthesised audio.

## Spec interpretations

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
- **Earthquake.** Holes scramble to new screen positions for the duration and
  animate back afterwards. Movement stays grid-logical throughout — that's the
  disorientation. A permanent scramble would compound across repeat events.
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
await runTests()      // 50 assertions: movement, timers, damage, scoring,
                      // difficulty, all six wildcards, leaderboard, pause
```

```js
fetch('/tests/intensity.js').then(r => r.text()).then(eval)
await measureIntensity()   // average/peak live hammers per difficulty band
```

Both sample inside `requestAnimationFrame`, so a throttled background tab
stretches the wall clock rather than corrupting results.

`window.__game` exposes state getters and helpers (`forceWildcard`,
`setElapsed`, `spawnHammerAt`, ...) used by the suites.
