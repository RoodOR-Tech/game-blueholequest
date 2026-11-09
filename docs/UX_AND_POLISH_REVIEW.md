# The Blue Hole Quest — UX and Look-and-Feel Review

Status: Proposed  
Reviewed: `feat/project-foundation` at `0977842`, built and run locally in Chromium at desktop (1280 × 800), phone portrait (390 × 844), and phone landscape (844 × 390).

## Scope

"Without additional requirements" is read as: no new features, content, or runtime dependencies. Every item is either a defect, or a better way of presenting something the game already does. Items that would add scope are parked in section 5.

Lint, type-check, the production build, and all 47 tests pass. Nothing below is caught by them.

Priorities:

- **P0** — Broken or misleading for players today.
- **P1** — The largest gains in look and feel for the least work.
- **P2** — Polish.

## 1. P0 — Defects

### 1.1 Dad's sprite sheet is corrupt

`public/assets/sprites/dad-sprites-v1.png` is truncated. Its pixel stream ends at 54% of the expected length, and the file ends in a garbage chunk. Chromium logs `WebGL: INVALID_VALUE: texImage2D: bad image data` and draws Dad as a solid black rectangle.

- Dad & Paula is the first and default team, so this is the first thing a new player sees in the hub.
- The same black rectangle appears in the victory line-up.
- The commit "Fix Dad rendering in victory celebration" did not address the cause.

Fix: re-export the sheet from the original artwork. It cannot be repaired from the file in the repository; the lower half of every frame is absent.

### 1.2 The B button abandons boss fights

Touch button meanings change between scenes:

| Scene                                    | A      | B                           |
| ---------------------------------------- | ------ | --------------------------- |
| Route action (`RouteActionScene.ts:128`) | Jump   | Attack                      |
| Boss (`LocationBossScene.ts:80`)         | Attack | Leave the fight immediately |

A player who has just spent a route learning "B attacks" will press B at the boss and be thrown back to the map with no confirmation (`LocationBossScene.ts:160`). Keep B as attack everywhere, and move "leave" to a deliberate action with a confirm step.

### 1.3 Touch controls cover the game in portrait

In portrait the canvas occupies the middle 43% of the screen, the rest is empty, and the D-pad and A/B are drawn on top of the canvas. They cover the dialogue box, Budda, the exit mat, the route prompts ("BEGIN THIS ROUT…"), and the bottom third of every menu.

The landscape layout already solves this with DOM buttons in the side gutters (`TouchControls.ts`, `style.css`). Apply the same idea to portrait: anchor the canvas to the top and place the DOM controls in the empty space beneath it. The on-canvas buttons can then be deleted.

The same overlap occurs on tablets and on any window narrower than 3:2, because the side-gutter layout only activates at `min-aspect-ratio: 3/2`.

### 1.4 Touch controls appear on desktop

`TouchControls` is created unconditionally, so mouse-and-keyboard players see a D-pad and A/B over the game. Show them only when a coarse pointer is present or after the first touch event.

### 1.5 Two relics are swapped

`bossLocations.ts` awards the Crystal Hound at Hillsboro West and the Golden Thumb at Hillsboro East. The GDD and D-010 have these the other way round (West is Dad & Paula's Golden Thumb). The save-migration table in `schema.ts` carries the same swap, so correct both together.

### 1.6 Three unreachable scenes ship in the build

`ForestQuestScene`, `LodgeQuestScene`, and `FoundryTestScene` are no longer started by any other scene. They can still be entered from an old save's checkpoint, where they always draw Dad regardless of the chosen team and label the HUD "DAD HP". Remove them, and map their three checkpoint IDs to the hub.

### 1.7 No pause, and no mute on touch

- The `pause` action is bound to a key and a gamepad button, but no scene reads it.
- Mute is the `M` key only. A phone player cannot silence the game.
- Music runs on `setInterval` (`GameAudio.ts`), so it keeps playing when the tab is hidden.

Add one small speaker/pause control to the HUD, and suspend the audio context on `visibilitychange`.

## 2. P1 — Biggest wins for look and feel

### 2.1 Text is blurred everywhere

This is the single largest visual problem. `textClarity.ts` forces every label to bold Arial Black at resolution 1. That anti-aliased text is drawn into the 256 × 240 canvas and then enlarged 1.5–3.3× with nearest-neighbour scaling, which turns the soft edges into smeared blocks.

It is also too small: 67 of the 85 text styles are 7 px or below, and four are 4 px. On a 390-pixel-wide phone a 6 px label is about 9 CSS pixels tall.

Recommendation: switch to one bitmap pixel font, which is sharp by construction at any whole-number scale, and set a floor of 8 px for anything a player must read. This also allows `textClarity.ts` to be deleted; it currently walks every object in every scene on every frame.

### 2.2 Scale by whole numbers

`Phaser.Scale.FIT` produces fractional scales (3.33× at 1280 × 800, 1.52× on a phone), so pixels are uneven widths and shimmer during the 512-pixel-wide scrolling scenes. Snap the canvas to the largest whole-number scale that fits. Combined with 2.1, this is what makes the game look intentionally retro rather than low-resolution.

### 2.3 Pre-shrink the character art

The five hero sheets and Budda are roughly 2172 × 724 illustrations, about 7 MB in total, drawn at 16% size. Consequences:

- **Appearance:** nearest-neighbour shrinking to 16% discards five of every six pixels more or less at random. Faces and outlines break up, and they flicker as characters move.
- **Download:** about 8.3 MB before the title appears (7 MB sprites, 1.3 MB script), with no loading indicator.
- **Startup freeze:** `cleanConnectedBackground` flood-fills the white background out of every sheet at boot. With CPU throttled 4× to approximate a mid-range phone, this blocked the page for 5.0 seconds in one stretch.

Export each sheet once at its on-screen size (frames about 43 × 116) with a transparent background. The download drops to well under 100 KB, the runtime clean-up code goes away, and the characters become crisp. Add a simple progress bar to `BootScene` regardless.

### 2.4 Characters and world are two different art styles

The heroes are detailed illustrations; every room, enemy, and boss is flat rectangles, triangles, and circles drawn in code. Side by side they do not look like the same game. Without commissioning art, the gap can be narrowed in code:

- Give scenery the same dark outline the characters have.
- Add two-tone shading (a lighter top edge, a darker bottom edge) to the fridge, hearth, platforms, and bosses.
- Use one shared palette file instead of per-scene hex literals.
- Add a ground shadow under the player, Budda, and bosses so they sit in the scene.

### 2.5 Replace the text HUD with meters

The HUD reads `HP 7/7 • LIVES 3/3 • MAGIC 5/5` as a line of text, and the boss's health is `BOSS 4/4` in the same line. Draw these as pips or bars. Place the boss bar at the top centre. This needs no assets and makes damage legible at a glance.

Boss scenes also keep a control legend (`MOVE: D-PAD • ATTACK: A / X • B / ESC: LEAVE`) on screen permanently. Show it for the first few seconds only.

### 2.6 The hub message never goes away

"WELCOME HOME. THE HEARTH AWAITS FIVE RELICS." stays on screen permanently, across the area the player walks through, overlapping both the player and the "TO HWY 26" mat. The interaction prompt is drawn 15 pixels below it and collides with it. Dismiss messages after a few seconds or on the next input, and reserve one strip at the bottom for both.

### 2.7 The magic-choice panel is see-through and sits under the buttons

The "CHOOSE MAGIC" panel lets the banner behind it show through its top edge, and the touch buttons are drawn above it (depth 700), covering the third option and the instruction line. Make the panel opaque, dim the scene behind it, and hide gameplay buttons while a menu is open.

## 3. P2 — Polish

### 3.1 The hearth should change

The mantle is five 4-pixel dots, and the fire is two static triangles that are lit from the start even though the hub says "THE HEARTH IS COLD". Start with a dark hearth, enlarge the sockets, light each in its relic colour on return, and warm the room's wall and floor colours one step per relic. The homecoming tween and flash already exist; this gives them something to reveal.

### 3.2 Team portraits

Team select shows abstract two-blob icons while finished character art exists. Use each team's idle-frame head as its portrait, and show stats as short bars instead of `3 ATK / 1 MAG / 2 LIF`. Every team is labelled `READY`, which carries no information; drop it.

### 3.3 Comfort setting

There are 13 screen flashes and 7 screen shakes, and no way to reduce them. Add one toggle, honour `prefers-reduced-motion` by default, and convert flashes to short fades when it is on.

### 3.4 Combat feedback

Present already: knockback and a red or white tint on hit. Missing and cheap:

- Two to four frames of hit-stop when a blow lands.
- A dust puff on landing and a short squash on jump.
- A visible wind-up pose before boss shots, in addition to the text banner.
- Brief invulnerability shown as steady half-transparency after taking damage.

### 3.5 Input hints follow the device

Prompts mix all devices at once: `A / ENTER / TAP • BEGIN THIS ROUTE`, `UP / DOWN • A / B / ENTER: CHOOSE`. Show only the hint for the device last used. This also shortens every prompt enough to raise its font size.

### 3.6 Music

Each theme is an eight-note loop on one oscillator, which becomes grating within a minute. Without adding assets: add a bass voice an octave down, vary the pattern every fourth bar, and lower the default volume.

### 3.7 Page metadata

`index.html` has no favicon, no description, and no social preview tags. Since this is a gift shared by link, a title, description, and preview image make the link look intentional when it arrives in a message. Also add `user-select: none` and `-webkit-touch-callout: none` to the body so long-presses do not select text or open a menu.

### 3.8 Leftover GDD text

The find-and-replace damage in the GDD (`MERRY KrisTMAS`, `EMERALD LeaF`, `MARBLE Mountain statue`) is **not** present in the code; relic names in `bossLocations.ts` are clean, and the end crawl is not implemented. Correct the GDD so the damage is not copied in when the crawl is added: the line should read `MERRY CHRISTMAS TO THE ENTIRE CREW!`

## 4. Recommended order

1. **1.1** — re-export Dad's sheet. Nothing else matters while the default hero is a black box.
2. **1.2, 1.3, 1.4** — one pass over `TouchControls.ts` and its call sites.
3. **2.1, 2.2, 2.3** — font, whole-number scaling, pre-shrunk sprites. These three together account for most of the "elevated" look.
4. **1.5, 1.6, 1.7** — content and housekeeping.
5. **2.4–2.7**, then section 3.

## 5. Parked — would add scope

- Commissioned background, enemy, and boss art to match the characters (the full answer to 2.4).
- Composed music tracks (the full answer to 3.6).
- Save export/import or cloud saves.
- Installable offline app.
- Remappable controls.
