# Sprite harness

Offline tooling that renders the mole and packs it into a spritesheet.
Development-only — the game itself still ships zero dependencies.

## Setup

Project-local install; nothing is written outside this directory.

```bash
npm install
```

`@napi-rs/canvas` ships prebuilt binaries, so there is no node-gyp step and
no cairo/pango system packages to install.

## Use

```bash
npm run sprites:build     # render every frame, then pack the sheet
npm run sprites:test      # end-to-end verification
```

Individually:

```bash
npm run sprites:render -- --scale 2      # frames only, 2x supersample
npm run sprites:pack   -- --width 2048   # sheet only, wider atlas
```

Output lands in `build/` (gitignored, regenerable):

| File | What |
|---|---|
| `build/sprites/frames/*.png` | one trimmed PNG per frame |
| `build/sprites/frames.json` | per-frame trim + offset manifest |
| `build/sprites/mole-sheet.png` | packed spritesheet |
| `build/sprites/mole-atlas.json` | frame rects + clip index |

## How it fits together

`js/mole-art.js` holds the mole's drawing code and is the single source of
truth. The browser loads it as a global (`MoleArt`) before `js/game.js`; the
harness `require`s the very same file. Nothing is duplicated, so a rendered
sheet is by construction what the game draws.

- `frames.js` — clip definitions. Each clip mirrors a real animation state
  from `drawPlayerMole()`, sampled into discrete frames via the existing
  `rise` and `sx`/`sy` squash parameters.
- `render-frames.js` — draws each frame into a scratch cell, alpha-trims to a
  tight bbox, records the offset back to the hole-centre anchor.
- `pack-sheet.js` — shelf-packs the trimmed frames (tallest first) into a
  power-of-two sheet with 2px padding, emits the atlas.
- `test-harness.js` — verifies the whole pipeline.

## Atlas format

```jsonc
{
  "image": "mole-sheet.png",
  "size":  { "w": 1024, "h": 2048 },
  "scale": 1,
  "anchor": { "x": 150, "y": 230 },   // hole centre frames were drawn around
  "frames": {
    "base.idle.00": {
      "x": 0, "y": 0, "w": 88, "h": 99,
      "offsetX": -44, "offsetY": -90  // draw at (holeX + offsetX, holeY + offsetY)
    }
  },
  "clips": { "base.idle": ["base.idle.00", "base.idle.01"] }
}
```

Frames are trimmed, so `offsetX`/`offsetY` are what re-anchor a sprite to its
hole. The harness verifies this round-trips pixel-exactly against a direct
`drawMoleAt` call.

## Adding frames

Edit the `CLIPS` table in `frames.js`. If a new frame is large enough to hit
the scratch cell edge, `render-frames.js` throws by name rather than silently
shipping a clipped sprite — raise `CELL_W`/`CELL_H` when that happens.
