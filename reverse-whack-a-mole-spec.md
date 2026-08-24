# Reverse Whack-a-Mole — Game Design Specification

## Concept

A single-player arcade survival game where the player IS the mole. Hammers slam down from above in increasingly aggressive patterns. The player navigates a grid of holes, burrowing underground to dodge and popping up to score — but can never hide forever. A surface timer forces the mole above ground periodically, creating a constant tension between hiding and exposure.

The game is a browser-based, single-screen 2D game. Target session length is 45–90 seconds. The primary engagement loop is: survive → beat the high score → hand the laptop to the next person.

---

## Arena Layout

The playing field is a grid of holes arranged in a **4 columns × 3 rows** layout (12 holes total). Each hole is a visually distinct circular burrow on a grassy/dirt-textured ground plane.

```
 [ H ]  [ H ]  [ H ]  [ H ]
 [ H ]  [ H ]  [ H ]  [ H ]
 [ H ]  [ H ]  [ H ]  [ H ]
```

Spacing between holes should be generous — roughly equal horizontal and vertical gaps — so hammer strike zones are visually readable and the player can plan movement paths at a glance.

The arena is centered on screen with a HUD bar above (score, timer, lives) and a minimal footer below (controls hint on first play only).

---

## Player (The Mole)

### States

The mole exists in exactly one of three states at any time:

1. **Above ground (vulnerable):** Visible, standing on top of a hole. Can be hit by hammers. Can move to adjacent holes (movement is instant — the mole "dives and pops up" at the destination). This is the default starting state.

2. **Burrowing (transitioning):** A very brief animation (~200ms) of the mole diving into the current hole. Invulnerable during this transition. Cannot move during this transition.

3. **Underground (hidden):** Inside a hole, invisible to hammers, safe from damage. The hole the mole is hiding in should have a **subtle visual tell** (a slight wiggle, tiny eyes peeking out, or small dust particles) so the player doesn't lose track of their position — but this tell should NOT be obvious enough that it looks like a "hit me" sign to someone watching casually (it's flavor, not gameplay-critical for spectators).

### Movement

- **Input:** Arrow keys OR WASD. Each press moves the mole one hole in that direction on the grid.
- **Movement style:** Instant teleport between holes — the mole dives down at the origin and pops up at the destination. There is no "walking across the surface." This keeps the game snappy and arcade-feeling.
- **Boundary behavior:** Pressing a direction at the grid edge does nothing (no wraparound).
- **Movement while underground:** Allowed. The mole tunnels to an adjacent hole and remains underground at the destination. The subtle visual tell follows the mole.
- **Movement while above ground:** The mole briefly ducks into the current hole and pops up at the destination hole. This movement has a brief cooldown (~150ms) to prevent spam-teleporting.

### Burrowing

- **Input:** Spacebar (or Down arrow when not at the bottom row — see below) to burrow. A dedicated key (Spacebar) is cleaner.
- **Spacebar pressed while above ground:** Mole burrows underground at current position.
- **Spacebar pressed while underground:** Mole pops up above ground at current position.

### Surface Timer (Anti-Camp Mechanic)

The mole **cannot stay underground indefinitely.** A circular/radial countdown indicator appears around the mole's hole when underground.

- **Duration:** Starts at **3.0 seconds** of underground time per burrow.
- **Visual:** A shrinking ring or depleting circular progress bar around the hole. Changes color: green → yellow → red as time runs out.
- **On expiry:** The mole is **forcibly ejected** above ground at its current position with a comedic "pop!" animation and a brief stun (~400ms) during which it cannot move or re-burrow. This is dangerous and should feel punishing but funny.
- **Recharge:** The underground timer fully resets when the mole surfaces voluntarily. It does NOT recharge while above ground — it resets instantly upon voluntary surfacing.
- **No partial refund:** If the mole surfaces at 1.2s remaining, the next burrow still gives the full 3.0s. The penalty is only for being forced out.

---

## Hammers (Threats)

Hammers are the primary obstacle. They slam down onto specific holes from above.

### Hammer Behavior

1. **Telegraph:** Before striking, a hammer shows a **warning indicator** on the target hole — a red crosshair/shadow/highlight that appears for a brief warning window. This gives the player time to react.
2. **Strike:** The hammer slams down onto the hole. If the mole is above ground on that hole, it takes a hit.
3. **Recovery:** The hammer lifts back up and disappears. The hole is safe again.

### Timing

- **Warning duration:** Starts at **1.0 second** (early game), decreases to **0.4 seconds** (late game). This is the primary difficulty lever.
- **Strike duration:** The hammer stays down for **0.3 seconds** (the danger window).
- **Multiple simultaneous hammers:** Yes. The game can (and should) telegraph multiple strikes at once. Early game: 1 hammer at a time. Late game: up to 4–5 simultaneous.

### Targeting Patterns

Hammers should use a mix of targeting strategies, weighted by difficulty phase:

- **Random single:** One random hole targeted. (Common early game.)
- **Player-adjacent:** Targets a hole next to the mole's current position. Keeps the player moving. (Increases over time.)
- **Player-direct:** Targets the mole's exact current hole. Forces a reaction. (Rare early, common late.)
- **Row sweep:** All holes in a row are targeted in quick sequence (left-to-right or right-to-left with ~0.2s stagger). (Mid-game onward.)
- **Column slam:** All holes in a column targeted simultaneously. (Mid-game onward.)
- **Cross pattern:** The mole's hole plus all 4 cardinal-adjacent holes. (Late game, high threat.)
- **Random cluster:** 2–3 random holes targeted at once. (Common throughout.)

### Visual Design

Each hammer should be cartoonishly oversized — a big wooden mallet or cartoon fist. The slam should feel impactful: screen-shake on strike, dust particles, a satisfying THWACK sound. Even misses should feel dramatic.

---

## Scoring

Points are earned by **being above ground.** The fundamental risk-reward: hiding is safe but earns nothing; surfacing scores points but risks death.

### Scoring Rules

- **Passive surface score:** The player earns **+1 point per 0.1 seconds** spent above ground (i.e., 10 points/second on the surface). A visible point counter ticks up smoothly.
- **Dodge bonus:** If a hammer strikes a hole the mole was on within the last 0.5 seconds (i.e., the mole dodged just in time), award a **"Close Call!" bonus of +25 points** with a flashy popup.
- **Survival milestone:** Every 15 seconds survived, a brief **"+50 SURVIVAL BONUS"** banner appears.
- **Combo system:** Each consecutive "Close Call" dodge within a 3-second window increases a combo multiplier (×2, ×3, ×4, capped at ×4). The multiplier resets after 3 seconds without a close call. The combo multiplier applies to the close-call bonus only, not passive scoring.

### Score Display

- Current score: Large, top-center of screen. Smoothly animated number counter (rolls up, doesn't jump).
- High score: Smaller, displayed beside or below the current score. Pulses/glows when the current score surpasses it.

---

## Lives & Damage

- **Starting lives:** 3 (displayed as mole-face icons in the HUD).
- **Hit penalty:** When struck by a hammer, the mole loses 1 life. The screen flashes red, the mole does a dazed animation (stars circling head, ~0.8s stun), and there is a brief invulnerability window of **1.5 seconds** after being hit.
- **Death:** At 0 lives, the game ends. The mole does a dramatic flattened/squished animation, the screen dims, and the Game Over screen slides in.
- **No health regeneration** by default (extra lives are available only via wildcards).

---

## Difficulty Progression

Difficulty scales continuously over time, not in discrete "levels." The game uses elapsed survival time as the sole difficulty driver.

| Time Elapsed | Hammer Warning | Hammers Active | Targeting Bias | Hammer Interval |
|---|---|---|---|---|
| 0–15s | 1.0s | 1 at a time | 80% random, 20% adjacent | Every 2.0s |
| 15–30s | 0.8s | 1–2 at a time | 60% random, 30% adjacent, 10% direct | Every 1.5s |
| 30–45s | 0.65s | 2–3 at a time | 40% random, 30% adjacent, 20% direct, 10% patterns | Every 1.2s |
| 45–60s | 0.5s | 3–4 at a time | 20% random, 30% adjacent, 30% direct, 20% patterns | Every 0.9s |
| 60s+ | 0.4s | 4–5 at a time | 10% random, 20% adjacent, 40% direct, 30% patterns | Every 0.7s |

"Patterns" refers to row sweeps, column slams, and cross patterns as described above.

The goal is for an average player to survive 30–50 seconds, a good player 60–80 seconds, and a great run to push past 90 seconds.

---

## Wildcards (Special Events)

Wildcards are random events that occur every **12–20 seconds** (randomized interval). Only one wildcard can be active at a time. Each wildcard is announced with a brief banner across the screen and a distinct sound cue.

### Wildcard List

1. **Grid Lockdown** — 3–4 random holes become "blocked" (visually boarded up / covered with planks). They cannot be entered or moved through for **5 seconds.** If the mole is currently in a locked hole, it is forcibly ejected. This reduces escape routes and creates claustrophobic pressure.

2. **Extra Life** — A glowing heart/star appears above a random hole for **3 seconds.** The mole must be above ground on that hole to collect it. Awards +1 life (max 5 lives). Risk-reward: you have to expose yourself on a specific hole to grab it.

3. **Frenzy Mode** — For **4 seconds**, hammer frequency doubles and warning time halves, but all points earned during frenzy are worth **triple**. A high-risk, high-reward window. The screen edges pulse with energy during frenzy.

4. **Decoy Mole** — A fake mole pops up on a random hole for **4 seconds**, drawing 50% of hammer targeting toward it. Gives the player breathing room. The decoy is visually similar to the player mole but with a slightly different color or a wind-up-toy base.

5. **Earthquake** — The entire grid shakes for **3 seconds.** All holes shift positions randomly (the grid rearranges). The mole stays in its logical grid position but must re-orient spatially. Purely disorienting, not directly dangerous.

6. **Golden Mole** — The mole glows gold for **4 seconds.** During this time, points are earned at **5× rate** and the mole is invulnerable. Feels amazing. Rare (lower weight in the random pool).

### Wildcard Weights

Not all wildcards should appear equally:

- Grid Lockdown: 25% (common threat)
- Extra Life: 15% (uncommon reward)
- Frenzy Mode: 20% (common high-risk event)
- Decoy Mole: 15% (uncommon relief)
- Earthquake: 10% (rare disruptor)
- Golden Mole: 15% (uncommon power fantasy)

---

## Game Flow & Screens

### 1. Title Screen

- Game title: large, playful, bold font. "REVERSE WHACK-A-MOLE" or a snappier name like **"UNHAMMERED"** or **"DON'T BONK ME"**
- A looping idle animation of a mole dodging hammers in the background
- **"Press SPACE to Start"** prompt (pulsing)
- High score displayed if one exists
- Minimal — no menus, no settings, no options. This is an arcade game.

### 2. Intro / First-Play Tutorial

On the very first play only (or after clearing local storage), a 3-step overlay tutorial:

- Step 1: "You are the mole. Arrow keys to move." (Arrows light up on screen)
- Step 2: "Spacebar to hide underground — but not forever!" (Show the timer ring)
- Step 3: "Stay above ground to score. Dodge the hammers!" (Show a hammer telegraph)

Each step dismissed by pressing the relevant key. Tutorial should take <10 seconds total. Skippable by pressing Space.

### 3. Gameplay Screen

- The arena (grid of holes) occupies the center ~70% of screen space.
- HUD at top: Score (center), Lives (left), Survival Timer (right), High Score (beside current score).
- Wildcard announcements appear as brief center-screen banners.
- Combo counter appears near the mole when active.

### 4. Game Over Screen

- Overlays on top of the frozen game state (the squished mole is still visible underneath).
- **"GAME OVER"** in large text.
- Final score (with animated count-up).
- "NEW HIGH SCORE!" celebration if applicable (confetti particles, glow effect).
- **Survival time** displayed.
- Stats: Hammers dodged, Close calls, Longest combo.
- Name entry for leaderboard: a simple 3-character initial input (arcade style AAA).
- **"Press SPACE to Retry"** prompt.

### 5. Leaderboard

- Displayed on the Game Over screen alongside the score, or toggled with a tab.
- Top 10 local scores: Rank, Initials, Score, Survival Time.
- Current run highlighted if it placed.
- Stored in `localStorage`.

---

## Visual Style

### Art Direction

Cartoonish, vibrant, and slightly exaggerated. Think "Saturday morning cartoon" crossed with classic arcade. The mood is comedic, not threatening — getting hit should be funny, not frustrating.

### Color Palette

- **Ground/Arena:** Rich earthy greens and browns. Lush grass surface, darker dirt around holes.
- **Mole:** Warm brown fur, big expressive eyes, pink nose. Simple shapes, high readability.
- **Hammers:** Grey steel head, wooden handle. Slightly oversized and wobbly.
- **Warning indicators:** Bright red pulsing glow / crosshair on targeted holes.
- **UI/HUD:** Clean white or cream text with dark outlines for readability over the game.
- **Wildcards:** Each has a distinct color identity:
  - Grid Lockdown: Orange/hazard
  - Extra Life: Pink/red heart glow
  - Frenzy: Electric purple
  - Decoy: Teal/cyan
  - Earthquake: Brown/rumble
  - Golden Mole: Gold/yellow shimmer

### Screen Effects (Juice)

Every interaction should have visible feedback:

- **Hammer strike (miss):** Dust cloud particles, brief screen-shake (2–3px, 100ms), THWACK sound.
- **Hammer strike (hit):** Bigger screen-shake (5–6px, 200ms), screen flash red, stars particle effect around mole, comical squish animation, bonk/boing sound.
- **Mole burrow:** Quick dust puff, soft digging sound.
- **Mole surface:** Pop-up with slight overshoot (squash-and-stretch), "boing" feel.
- **Close Call dodge:** Screen briefly flashes white at the edges, "whoosh" sound, "+25 CLOSE CALL!" floats up in yellow text.
- **Combo hits:** Each combo tier gets a bigger text popup and a rising-pitch sound ding.
- **Wildcard announce:** Brief screen-wide banner with icon, whoosh-in animation, distinct chime per wildcard type.
- **Forced eject (timer expired):** Exaggerated spring-loaded pop, cartoon "SPROING" sound, spiral stun stars.
- **Death:** Final squish, screen dims to ~40% brightness over 0.5s, sad trombone or comedic deflation sound.

---

## Audio

Audio is not mandatory for the build but dramatically improves the arcade experience. If implemented:

- **Background music:** Upbeat, looping chiptune or cartoon-style track. Tempo subtly increases with difficulty phase.
- **SFX priority list (implement these first):**
  1. Hammer slam (thwack)
  2. Mole hit (bonk/boing + pain yelp)
  3. Burrow (dig sound)
  4. Surface (pop)
  5. Close call (whoosh)
  6. Game over (sad trombone)
  7. Wildcard announce (chime)
  8. Score milestone / new high score (fanfare)

All sounds should be short (<0.5s for SFX) and punchy. No reverb. Arcade-crisp.

---

## Controls Summary

| Input | Action |
|---|---|
| Arrow Keys / WASD | Move mole one hole in that direction |
| Spacebar | Toggle burrow (above ground ↔ underground) |
| Enter | Confirm (menus, name entry) |
| Escape | Pause (if implemented) — optional |

The game must be **fully playable with one hand on the keyboard.** No mouse required at any point during gameplay. Mouse can be used for leaderboard name entry if desired but keyboard must also work.

---

## Technical Notes (Web Implementation)

- **Target resolution:** 1280×720 minimum, responsive up to 1920×1080. The game should scale (maintain aspect ratio with letterboxing) rather than stretch.
- **Rendering:** HTML5 Canvas (recommended) or DOM-based with CSS transforms. Canvas gives better performance for particles and screen-shake.
- **Frame rate target:** 60 FPS.
- **State management:** A simple finite state machine — `TITLE`, `TUTORIAL`, `PLAYING`, `PAUSED`, `GAME_OVER`.
- **Timing:** Use `requestAnimationFrame` with delta-time calculations. Do not tie game logic to frame rate.
- **Storage:** `localStorage` for high scores and leaderboard. JSON format.
- **Dependencies:** Aim for zero external dependencies. Vanilla JS + Canvas is ideal for an arcade game this scope. A lightweight library like Kontra.js or Kaplay is acceptable if it speeds development.
- **Deployment:** Single HTML file (or a small bundle) that can be opened directly in a browser. No server required for gameplay.

---

## Scope Priorities

If time is limited, build in this order:

### Must-Have (Core Loop)
1. Grid of holes, mole renders and moves between them
2. Mole burrow/surface toggle with spacebar
3. Underground timer with forced eject
4. Hammer telegraph → strike → hit detection
5. Lives system, game over on 0 lives
6. Score (passive surface scoring)
7. Difficulty ramp (hammer speed/frequency over time)
8. Title screen and game over screen with retry

### Should-Have (Completeness)
9. Close Call bonus + combo system
10. Leaderboard (localStorage, top 10, initials entry)
11. Screen-shake and particle effects
12. At least 3 wildcards (Grid Lockdown, Extra Life, Frenzy)
13. Sound effects (even just 3–4 key sounds)
14. First-play tutorial overlay

### Nice-to-Have (Polish)
15. All 6 wildcards
16. Background music
17. Animated title screen background
18. Stats on game over (dodges, combos, etc.)
19. Visual flourishes (squash-and-stretch, screen flash, confetti)
20. Survival milestones with banners
