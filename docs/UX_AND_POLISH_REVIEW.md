# The Blue Hole Quest — UX and Look-and-Feel Review

Status: Proposed  
Reviewed: GDD V3 (text and its four embedded mockups), `docs/IMPLEMENTATION_PLAN.md`, `docs/DESIGN_DECISIONS.md`

## Scope of this review

The repository contains no game code yet — only the GDD and two planning documents. This is therefore a review of the design and the plan, not of an implementation.

"Without additional requirements" is read as: no new features, content, platforms, or dependencies. Every item below either resolves something the GDD already specifies, or is a way of building an already-planned feature so it feels better. Where an item would genuinely add scope it is called out and parked in section 6.

Priorities:

- **P0** — Visible defects or contradictions. Fix in the documents before anything is built.
- **P1** — Foundation choices. Nearly free in M1–M2, expensive to retrofit.
- **P2** — Polish pass. Apply during M4–M5.

## 1. P0 — Defects that would reach the screen

### 1.1 Find-and-replace damage in player-facing text

Several strings look like casualties of a global name replacement. As written, these ship in dialogue and the finale:

| Location | Current text | Likely intent |
| --- | --- | --- |
| End crawl (§9) | `MERRY KrisTMAS TO THE ENTIRE CREW!` | `MERRY CHRISTMAS` — or a deliberate pun, in which case `KRIS-TMAS` |
| Walla Walla relic line (§8) | `RETRIEVED THE EMERALD LeaF!` | `EMERALD LEAF` |
| Relic IDs (§4) | `RELIC_EMERALD_Leaf`, `RELIC_MARBLE_Mountain statue ` | Covered by D-012 for IDs, but display strings are not |
| Bend relic line (§8) | `RETRIEVED THE MARBLE Mountain statue !` | `MARBLE MOUNTAIN` |
| HUD nameplate (§2.2) | `JASON & Hilary`, `JOE & Cia`, `Kris & Lea` | All caps, matching `DAD & PAULA` |
| Dialogue keys (§8) | `Hilary_greeting`, `Cia_greeting`, `Kris_greeting`, `Lea_greeting` | Lowercase keys |

D-012 fixes capitalization of names and machine IDs. It should be extended to cover display strings, and the dialogue should get one manual proofread rather than another search-and-replace.

### 1.2 The fifth relic has three identities

Text says "Marble Mountain statue"; the level-up mockup says "Marble Baseball"; the Bend relic line says it is "balanced with diamond precision" (a baseball-diamond joke) and the old Phase 2 boss carries a baseball bat. The relic was evidently renamed without updating its jokes. Pick one name and rewrite the flavour line to match.

### 1.3 The mockups contradict the approved decisions

The four images in the GDD should not be used as art references. Specific problems:

- **Hearth scene:** the hero is a recognisable Link, the seated figures read as Zelda-series characters, the mantle relics are rupee-shaped, and the HUD shows `RUBIES` and `LIVES`. All of this conflicts with D-004 and D-013, and neither rubies nor lives exist in the GDD. The dialogue box also shows a duplicated `MAGIC` label, garbled text, and a literal `[ARROW]` token.
- **Level-up screen:** `JUMP SPELL` appears three times, a family member is labelled `DAUGHTER`, and the touch D-pad and A/B buttons sit on top of a relic socket, the dialogue text, and the HUD.
- **Overworld map:** Walla Walla sits in the centre between Rockaway and Bend, Rockaway is labelled twice, and placeholder text (`GDD PALACE`, `ACADEMIC BAL`) is baked in. The geography does not match the progression in D-010.
- **Budda sheet:** Hillsboro East appears twice and contains spelling errors.

Recommendation: mark these as mood boards only, and produce one corrected HUD and one corrected map layout before art production starts.

### 1.4 Hearts or blocks

The GDD text describes Life and Magic as blocks. Two mockups draw Life as hearts. Decide once; blocks are the better fit because the GDD's costs and perks are all expressed in blocks.

### 1.5 Perks and costs that round to nothing

- JUMP costs 2 blocks and REFLECT costs 3. Joe & Cia's perk is −25% MP cost, and Magic levels also reduce cost. With whole blocks, 25% off 2 is still 2 — the perk is invisible.
- Jason & Hilary regenerate 1 HP per 30 seconds, which a player will never notice.

No rule needs to change. Store Life and Magic in finer units internally (for example 16 per block), draw partially filled blocks, and pulse the HUD block when regeneration ticks. The same perks then become visible.

### 1.6 Spell casting has one button and two spells

SELECT is mapped to "Spell", but there is no specified way to choose between JUMP and REFLECT. Without a decision the player will have to pause mid-fight. Suggested resolution within the existing button set: SELECT casts the spell shown in the HUD; pausing switches it. Show the active spell and its cost in the HUD and dim it when Magic is insufficient.

### 1.7 Calamity cards are incomplete

The Wilson River card offers three choices but defines no outcomes. The Costco card has no effect at all. The Hwy 217 card names Omar's gear, which makes no sense when Jen & Omar are the active team or have not been met yet. These need outcomes and name interpolation before the "one calamity" in the vertical slice can be built.

## 2. P1 — Foundation choices that determine feel

### 2.1 Put touch controls beside the picture, not on it

256 × 240 is almost square. On a phone held in landscape the scaled game is roughly half the screen width, leaving wide empty bars on both sides. Those bars are exactly where thumbs rest. Place the D-pad in the left bar and A/B/SELECT/START in the right bar, and nothing ever covers the playfield, the HUD, or dialogue. In portrait, stack the canvas at the top and the controls beneath it.

Supporting details, all part of the already-planned touch layer:

- Respect notch and home-indicator safe areas.
- Disable page scroll, pinch-zoom, text selection, and the long-press menu over the game.
- Let the D-pad re-centre under wherever the left thumb lands (the GDD already calls it "dynamic").
- Use 4-way input on the overworld; in side view treat left/right as movement and up/down as modifiers, with a generous dead zone so thrusts are not triggered by accident.
- Minimum 48 px touch targets.

### 2.2 Integer scaling

Nearest-neighbour scaling at a fractional factor produces uneven pixel widths that shimmer whenever the camera scrolls. Scale the world canvas only by whole numbers (the largest that fits) and let the responsive overlay from D-008 absorb the leftover space. Round the camera and sprite positions to whole pixels to prevent jitter.

### 2.3 Fixed-rate game logic

Many phones and tablets refresh at 120 Hz. If movement and animation are tied to display frames, the game runs at double speed on those devices and the GDD's frame timings (60 ms slashes, 120 ms walk frames) are meaningless. Run game logic on a fixed 60 Hz step from the first commit.

### 2.4 Dialogue must wrap itself

The script hard-codes line breaks, and 32 of its 51 lines are longer than 32 characters — the most a 256-pixel-wide screen can hold with an 8-pixel font. The longest is 55. Remove authored line breaks from the data, wrap at render time, and add:

- Typewriter reveal; a tap completes the line, a second tap advances.
- A blinking "more" indicator.
- A speaker nameplate.
- One pixel font, verified to include `&`, `'`, `*`, `!`, parentheses, and digits.

### 2.5 Separate hurtboxes from hitboxes

The animation table lists one box per state and mixes the two meanings (12 × 28 for the body, 24 × 28 while slashing). Define them separately. Make the player's hurtbox slightly smaller than the sprite and the weapon hitbox slightly larger — the single cheapest way to make combat feel fair, and consistent with D-011.

### 2.6 Death and retry

The plan lists "death and respawn" without rules. To match D-011: respawn at the entrance of the current room, keep collected keys and opened doors, lose no experience, and restart boss attempts at the boss door with full Life. Target under two seconds from death to control.

### 2.7 Input-aware prompts

The map mockup says "PRESS A TO BEGIN". Prompts should show the glyph for whichever device was used last (key name, gamepad button, or "TAP"). The first tap on the title screen also serves to unlock audio on mobile browsers.

### 2.8 Interruptions

Auto-pause when the tab is hidden, the window loses focus, the device rotates, or a gamepad disconnects. Mute audio while hidden.

### 2.9 Save reliability on phones

Request persistent storage from the browser at first save. Safari can otherwise evict `localStorage` for sites that go unvisited, which is a real risk for a gift that is played over a holiday and revisited later. Also: make Continue the default title option when a save exists, confirm before New Game overwrites it, and show a brief "saved" indicator at the fridge and at checkpoints.

## 3. P2 — Look and feel

### 3.1 A palette with a story

Define one master palette and a small sub-palette per zone, each with a signature accent taken from its relic: hickory gold, crystal blue, amber, emerald, marble grey-white. Then use it in the hub:

- The Blue Hole starts in a cold, desaturated palette with a dark hearth.
- Each returned relic lights its socket in its own colour and warms the room's palette one step.
- The finale ignition is the last step of a change the player has watched build.

This satisfies the existing acceptance criterion that relic return "visibly changes the Blue Hole hub" with palette swaps rather than new art.

### 3.2 Combat feedback

All temporary-asset friendly and all small:

- Three to four frames of hit-stop on a landed blow.
- White flash and knockback on the enemy.
- One-to-two pixel screen shake on heavy hits.
- Dust puff on landing; variable jump height by hold duration.
- A spark and distinct sound when the shield auto-blocks, so players learn the shield exists.
- Boss high/low guards telegraphed by pose and position, never by colour alone.

### 3.3 The duo on screen

The GDD shows each team as a lead plus companions; Jen & Omar's team is four people and a dog. A five-sprite line on a 256-pixel screen hides enemies and hazards. Suggested rule: lead plus one follower in combat rooms, the full party in towns, the overworld, and cutscenes. Followers trail the lead on a short delay, are drawn behind enemies, and never take damage or block movement.

### 3.4 HUD

Team portrait and nameplate, Life, Magic, active spell, and experience toward the next level. Nothing else. Remove lives and currency (see 1.3).

### 3.5 Level-up screen

Show the concrete effect of each choice ("WRENCH DAMAGE 3 → 4", "JUMP COST 2.0 → 1.5") rather than a bare level number. `LVL 1 → 8` in the mockup reads as a jump from 1 to 8.

### 3.6 Team selection

- Draw stats as bars and state each perk in one plain sentence.
- In the vertical slice, show the four unfinished teams as clearly unavailable rather than selectable-then-refused.
- State on the screen that the choice is permanent for the save.

### 3.7 Gates that explain themselves

When a route is blocked, say why in the world's voice ("THE FOG IS TOO THICK TO SEE THE ROAD"). The fisherman's line already does half of this; the gate tile should do the other half.

### 3.8 Encounter pacing

Keep random encounters as specified, but: no encounter within a few steps of the last one, none on road tiles, and never the same calamity card twice in a row.

### 3.9 Motion and flash comfort

The plan already includes a reduced-flashing setting. Extend the same switch to cover motion:

- **Tipsy Sway** tilts the screen for 20 seconds. A rotated pixel canvas looks broken and can cause nausea. Implement it as a gentle horizontal wave of the picture instead — a period-authentic effect — and reduce it to a HUD icon when the comfort setting is on.
- Budda's "warm screen-flash" becomes a soft fade.
- Invulnerability blink becomes a steady half-transparency.
- Screen shake is disabled.

### 3.10 Transitions and pacing

One wipe style for encounters, a fade for doors, all under 400 ms. Every dialogue and cutscene is skippable; the finale crawl is skippable after its first viewing. Style the loading screen to match the title, and load assets per zone so the first screen appears quickly.

## 4. Suggested amendments to the planning documents

**`DESIGN_DECISIONS.md`**

- Extend D-012 to cover display strings and dialogue keys (1.1).
- Add decisions for: the fifth relic's name (1.2), hearts versus blocks (1.4), spell selection (1.6), death and retry rules (2.6).
- Extend D-008 to state integer scaling and that touch controls occupy the bars outside the canvas (2.1, 2.2).

**`IMPLEMENTATION_PLAN.md`**

- M1: add fixed-rate logic, integer scaling, auto-pause, and persistent-storage request.
- M2: add separate hurtbox/hitbox definitions and the feedback list in 3.2.
- M3: add self-wrapping dialogue.
- Section 7 acceptance criteria, add:
  - No touch control overlaps the playfield, HUD, or dialogue at any supported aspect ratio.
  - All dialogue fits its box at a 360-pixel-wide viewport.
  - Gameplay speed is identical at 60 Hz and 120 Hz.
  - Death-to-control is under two seconds.
  - The comfort setting removes all flashing, shake, and sway.

## 5. Recommended order

1. Resolve section 1 in the documents (no code required).
2. Fold section 2 into M1–M3 as listed above.
3. Apply section 3 during M4, and verify against the amended acceptance criteria in M5.

## 6. Parked — would add scope

Noted for completeness; not recommended now.

- Save export/import or cloud saves (the real fix for 2.9).
- Installable offline app.
- Remappable controls beyond the planned touch-layout setting.
- Visible overworld encounter markers in place of fully random encounters.
- Haptic feedback on touch devices.
