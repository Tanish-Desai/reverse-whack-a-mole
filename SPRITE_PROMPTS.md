# Sprite Generation Prompts — Reverse Whack-a-Mole

Target model: **GPT Image 2**. Generate in the order below. Prompt 0 produces the
style anchor; **attach the anchor image as a reference to every later prompt.**

## Locked style contract

Repeat these verbatim in every prompt (they are already embedded below):

- **Camera:** 3/4 top-down, viewed from roughly 25° above the horizon. Holes read
  as flattened ellipses, ~2.1:1 wide-to-tall. Never straight-on side view, never
  pure overhead.
- **Light:** single soft key light from the upper-left, warm; shadows fall
  down-right. No rim light, no lens flare.
- **Rendering:** flat vector-leaning cartoon with chunky dark-brown outlines
  (not black), 2–3 flat shading bands per surface, no gradients, no texture
  noise, no airbrushing.
- **Mood:** friendly 90s arcade cabinet, saturated and punchy, slightly chunky
  proportions. Cute, not grim.
- **Palette (name these explicitly, do not invent colors):**
  - Fur: `#6b4526` dark, `#8a5c33` mid, `#a9743f` light, `#d8b184` belly
  - Dirt/wood: `#7a5533` mid, `#1b1109` hole void
  - Grass: `#7ed957` bright, `#cfe6c0` pale highlight
  - Accents: `#ffd23f` gold, `#ff9130` orange, `#ff5c8a` pink, `#2fd4d4` teal
- **Output:** transparent background (GPT Image 2 does real alpha — ask for it
  directly). If a generation comes back with a baked background, re-roll with
  "flat #FF00FF magenta background" and key it out.

## Game-accurate dimensions

Design resolution is 1280×720. At 1:1 in-game scale:

| Asset | In-game size | Generate at | Downscale factor |
|---|---|---|---|
| Hole ellipse | 132 × 62 px | 1024 × 1024 | ~7× |
| Boarded hole | 156 × 90 px (planks overhang) | 1024 × 1024 | ~7× |
| Mole, full rise | ~90 × 110 px | 1024 × 1024 | ~9× |
| Hammer | ~150 × 260 px | 1024 × 1536 | ~6× |
| Grass ground | 1280 × 720 | 1536 × 1024 | ~1.2× |

Always generate large and downscale with a good filter afterward — do not ask
the model for small images.

---

## Prompt 0 — Style anchor (generate this FIRST)

> A single reference sheet for a 2D arcade video game's art style, arranged as
> three separate objects on one flat neutral light-grey backdrop with generous
> space between them: on the left, a cartoon mole with brown fur popping halfway
> out of a dirt hole; in the centre, a wooden mallet with a pale wooden head and
> a darker handle, standing upright; on the right, a round dirt hole in green
> grass with three wooden planks nailed across it.
>
> Art style: flat vector-leaning cartoon, chunky dark-brown outlines rather than
> black, two to three flat bands of shading per surface, absolutely no gradients,
> no texture noise, no airbrush shading. Friendly 90s arcade cabinet look,
> saturated and punchy, slightly chunky exaggerated proportions, cute rather
> than grim.
>
> Camera: 3/4 top-down view from roughly 25 degrees above the horizon, so
> circular holes read as flattened ellipses about twice as wide as they are tall.
> Single soft warm key light from the upper left; all shadows fall down and to
> the right.
>
> Colours, used exactly: fur in #6b4526, #8a5c33, #a9743f with a #d8b184 belly;
> dirt and wood in #7a5533 with #1b1109 for the dark hole interior; grass in
> #7ed957 with #cfe6c0 highlights.
>
> No text, no labels, no watermarks, no drop shadows onto the backdrop.

**Pick the single best result and reuse it as the reference image everywhere below.**

---

## Prompt 1 — Mole base sprite

> Using the attached reference sheet for style and palette, draw a single cartoon
> mole character, full body, standing upright and facing the viewer, arms at its
> sides, cheerful and alert expression with large round eyes, a small pink snout,
> two small pale front teeth, and small clawed paws. No hole, no ground, no
> shadow beneath it — just the isolated character.
>
> Same flat vector-leaning cartoon style as the reference: chunky dark-brown
> outlines, two to three flat shading bands, no gradients, no texture noise.
> Same 3/4 top-down camera angle, roughly 25 degrees above the horizon. Same soft
> warm key light from the upper left.
>
> Fur in #6b4526, #8a5c33 and #a9743f with a #d8b184 belly.
>
> Centred in frame, fully transparent background, no drop shadow, no text.

**Then hand-edit the animation frames from this base.** Do not ask GPT Image 2
for a spritesheet grid — it will not hold the character consistent across cells.
Frames the game needs: idle, dive/burrow (~200ms squash), pop-up, bonked/dizzy,
forced-eject stun.

## Prompt 1b — Decoy mole variant

Same prompt as 1, with the fur line replaced by:

> Fur in teal: #1f7d80 dark, #2fa8ab mid, #54c9cc light, with a #bff0f0 belly.
> The character looks slightly hollow and artificial, like a painted wooden decoy.

## Prompt 1c — Golden mole variant

Same prompt as 1, with the fur line replaced by:

> Fur in metallic gold, #ffd23f as the main tone with #ffb347 shadows and
> #ffe9a3 highlights, rendered as flat bands rather than shiny metal reflections.

---

## Prompt 2 — Hammer

> Using the attached reference sheet for style and palette, draw a single cartoon
> wooden mallet, seen from the side and slightly above, oriented vertically with
> the head at the top and the handle running straight down. The head is a stubby
> barrel-shaped block of pale wood with visible flat-shaded end caps and two dark
> metal bands; the handle is a simple darker wooden shaft with a slightly flared
> grip at the bottom. It looks heavy and comically oversized.
>
> Same flat vector-leaning cartoon style as the reference: chunky dark-brown
> outlines, two to three flat shading bands, no gradients, no wood-grain texture
> noise. Same soft warm key light from the upper left, so the left face of the
> head is lighter and the right side falls into shadow.
>
> Wood in #7a5533 with lighter #a9743f faces; metal bands in dark desaturated grey.
>
> Centred in frame, fully transparent background, no motion lines, no impact
> effects, no drop shadow, no text.

The game already animates the slam, so generate the hammer at rest only.

---

## Prompt 3 — Open hole

> Using the attached reference sheet for style and palette, draw a single empty
> burrow hole in grassy ground, isolated with nothing else in frame. The hole
> opening is a flattened ellipse roughly twice as wide as it is tall, seen from a
> 3/4 top-down angle about 25 degrees above the horizon. The interior is solid
> very dark brown, #1b1109, fading to pure darkness with no visible bottom. A
> raised rim of loose dirt mound in #7a5533 rings the opening, sitting slightly
> higher at the back and thinner at the front, with a few small scattered dirt
> clods around the edge. A thin fringe of green grass in #7ed957 overhangs the
> outer edge of the mound.
>
> Same flat vector-leaning cartoon style as the reference: chunky dark-brown
> outlines, two to three flat shading bands, no gradients, no texture noise.
> Soft warm key light from the upper left, so the inner far wall of the hole
> catches a faint rim of light and the near inner wall is darkest.
>
> Centred in frame, fully transparent background, no drop shadow cast outward,
> no text.

## Prompt 4 — Boarded / covered hole

> Using the attached reference sheet for style and palette, draw the same burrow
> hole as the attached open-hole sprite, now sealed with three horizontal wooden
> planks nailed across the opening. The planks are rough-cut boards in #7a5533
> with lighter #a9743f faces, slightly uneven in length so their ends overhang
> the dirt rim, each with two dark round nail heads at either end. Small gaps
> between the planks show the dark #1b1109 hole interior behind them.
>
> Same flattened-ellipse hole, same raised dirt mound and grass fringe, same 3/4
> top-down camera about 25 degrees above the horizon, same flat vector-leaning
> cartoon style with chunky dark-brown outlines and two to three flat shading
> bands, no gradients, no wood-grain texture noise. Soft warm key light from the
> upper left so each plank casts a hard flat shadow onto the plank below it.
>
> Centred in frame, fully transparent background, no text.

**Attach BOTH the style anchor and your final open-hole sprite here** so the
boarded version lines up with the open one. The two must be pixel-alignable —
the game swaps between them in place.

---

## Prompt 5 — Grass background

> Using the attached reference sheet for style and palette, draw a wide empty
> grassy field as a flat 2D game background, filling the entire frame edge to
> edge with no border and no vignette. The grass is a broad expanse of #7ed957
> broken up by soft irregular patches of slightly darker and slightly lighter
> green, with sparse #cfe6c0 pale highlight tufts and a scattering of tiny
> individual grass blades and a few small flat stones. The ground is seen from a
> 3/4 top-down angle about 25 degrees above the horizon, so the patches stretch
> subtly wider toward the bottom of the frame.
>
> Same flat vector-leaning cartoon style as the reference: flat bands of colour,
> no gradients, no photographic texture, no noise, no individual rendered blades
> covering the whole surface. Keep the whole field visually calm and low-contrast
> so bright game objects placed on top stay readable.
>
> Absolutely no holes, no mounds, no characters, no objects, no text, no
> watermark, no horizon line, no sky.

Low contrast matters here — the HUD, hammer telegraphs and the mole all sit on
top of this. A busy background will destroy readability of the red strike
warnings.

---

## After generation

1. Key out the background if alpha didn't come through clean.
2. Downscale with a high-quality filter (Lanczos), then sharpen slightly.
3. Quantize all assets against **one shared palette** so nothing drifts.
4. Trim to uniform cells and pack the mole frames into a sheet.

Steps 1–4 are deterministic — hand me the raw PNGs and I'll script them.
