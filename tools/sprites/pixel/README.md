# Pixel art set

The retro-RPG sprite set: mole, holes, hammer, grass. Authored as code
rather than generated, so every asset is deterministic, regenerable, and
drawn from one shared palette.

```bash
npm run pixel:build    # build sheet + atlas + scenery PNGs -> build/pixel/
npm run pixel:scene    # composite a game-scale preview scene
npm run pixel:test     # 27 checks
```

## Why code and not AI generation

The style contract in `SPRITE_PROMPTS.md` — flat fills, no gradients, no
texture noise, exact named hex values — is what canvas path drawing does
natively. Authoring it directly removes the whole post-processing chain
(alpha-key, downscale, quantize) and its artifacts, and makes cross-asset
consistency a property of the code rather than something to eyeball.

## Consistency is enforced, not intended

Every asset draws only from `palette.js` (29 colours, organised as 3-4 step
ramps). Wood reuses the dirt ramp deliberately. The test suite verifies that
no asset contains a single off-palette or partially-transparent pixel, so
drift is a test failure rather than something you notice three weeks later.

## Pixel discipline

Art is drawn on a low-resolution logical grid and upscaled by an integer
factor (`SCALE = 3`) **in the indexed buffer**, never by a canvas transform.
No filtering can soften an edge. The tests confirm every NxN block in the
output is one flat colour.

Squash and stretch modulate the body's **pixel radii**, not a scale
transform, so every frame lands on whole pixels.

## Files

| File | Role |
|---|---|
| `palette.js` | the shared colour table + the gold variant remap |
| `raster.js` | indexed buffer, integer primitives, auto-outline |
| `mole.js` | parametric mole, squash-aware |
| `holes.js` | open hole, near-lip overlay, boarded hole |
| `hammer.js` | hammer at rest |
| `grass.js` | low-contrast field from value noise |
| `clips.js` | animation clips, tuned for pixel art |
| `scene.js` | game-scale composite preview |
| `png.js` | indexed buffer -> canvas |
| `ascii.js` | terminal debug view |

## Poses

`mole.js` is drawn from reference art: a rounded dome body with no visible
ears, oversized eyes with heavy black pupils, a large black nose over two
freckled cream muzzle lobes, buck teeth, long whiskers reaching outside the
silhouette, and clawed cream paws on the rim.

Expressions are `normal`, `closed` (mid-burrow, and the game-over pancake)
and `hurt` — squeezed eyes, angled brows, and a red lump with impact ticks
sweeping around it. The `dazed` clip uses `hurt`.

## Two things worth knowing

**The hole ships as two pieces.** Draw `hole`, then the mole, then
`hole-front`. The lip composites over the mole so a sinking one is occluded
by the near rim instead of hanging out below it. The atlas also carries
`holeMouth: {rx, ry}` — clip the mole to that ellipse for the same effect
without the overlay.

**Clips are not the vector harness's clips.** Pixel art animates in whole
pixels: the vector idle's 2% scale bob rounds to *no change at all* at this
resolution. The pixel idle is a 1px vertical offset instead. `clips.js` is
tuned so no two frames in a clip come out identical — there's a test for it,
and it has caught three real bugs: a clamped overshoot flattening `pop` into
two identical frames, 3-fold star symmetry aliasing the old `dazed`, and a
symmetric sine pulse on the hurt lump's impact ticks doing the same. The ticks
now sweep instead of pulsing, from unevenly spaced starts.

## Output

| File | What |
|---|---|
| `mole-sheet.png` | 75 frames, packed |
| `mole-atlas.json` | frame rects, offsets, clip index, hole-mouth geometry |
| `hole.png` / `hole-front.png` / `hole-boarded.png` | scenery |
| `hammer.png` | hammer at rest |
| `grass.png` | 1280x720 field |
| `manifest.json` | sizes, anchors, and the palette used |

Offsets are relative to the **hole centre** and already include the frame's
rise, so the game draws at `(holeX + offsetX, holeY + offsetY)`.

## Not yet wired into the game

This step produced the assets. `js/game.js` still draws the old procedural
art; swapping it over is the next step.

## Wired into the game

`js/sprites.js` loads the set at runtime and provides the draw helpers
`js/game.js` uses. Loading is asynchronous and **non-blocking**: the game
boots and plays on its original procedural art, then swaps the moment the
assets arrive. If they 404 the game still plays, just in the old style —
every call site falls back.

What the sprites replace:

| Game function | Asset |
|---|---|
| `buildBackground()` | `grass.png` |
| `drawHole()` | `hole.png` |
| `drawHoleLip()` | `hole-front.png` |
| `drawBlocked()` | `hole-boarded.png` (hazard glow stays procedural) |
| `drawHammerShape()` | `hammer.png` |
| `drawPlayerMole()` / `drawDecoy()` | atlas frames via `moleFrameName()` |

Effects and UI stay procedural on purpose: telegraphs, particles, floaters,
screen shake, the golden glow, the HUD and all text. Those are motion and
interface, not scenery, and several of them need alpha blending that a fixed
palette can't express.

### Integer scaling

`resize()` keeps the canvas backing store an **integer** multiple of the
1280x720 design resolution and lets CSS scale it the rest of the way, with
`image-rendering: pixelated`. Before this, the canvas was sized to the window
(e.g. 1320x742), so art pixels landed on fractional boundaries — some one
screen pixel wide, their neighbours two. That reads as a wobble across the
whole picture.

### Dev server

`tools/devserver.py` serves with `Cache-Control: no-store` and strips
`Last-Modified`/`ETag`. Plain `http.server` lets the browser heuristically
cache `js/*.js` and serve it **without even asking the server**, which
silently hides edits.
