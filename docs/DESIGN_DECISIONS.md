# The Blue Hole Quest — Design Decision Log

Status: Proposed for approval  
Applies to: Web-first MVP and vertical slice

These decisions reconcile contradictions in GDD V3. They are defaults for planning, not silent changes to the creative vision.

## D-001 — Primary release target

**Proposal:** The first release is a responsive browser game. A retro-ROM edition is a later demake.

**Reason:** Browser and ROM targets have different memory, resolution, asset, input, save, and tooling constraints. Keeping them separate protects the quality and schedule of both.

## D-002 — Technology

**Proposal:** TypeScript, Vite, and Phaser 3 for the web release.

**Reason:** The project needs tilemaps, two movement modes, collisions, input abstraction, animation, audio, cameras, and browser deployment. A focused 2D framework reduces custom engine work while retaining a TypeScript content pipeline.

## D-003 — Selected household and five relics

**Proposal:** The chosen family team begins at the Blue Hole with its own relic socket already dormant. Its regional palace is still visited, but its household appears there as magical echoes or supporting NPCs rather than captives. Completing that palace restores its relic. The other four households reunite normally.

**Alternative:** Reduce the goal to four relics based on the selected team.

**Reason for proposal:** It preserves all five zones, all five relics, the mantle composition, and the GDD’s complete content regardless of team selection.

## D-004 — Player naming

**Proposal:** Remove all player-facing references to Link. Use “the active team,” team names, or neutral identifiers in code and dialogue.

**Reason:** The game’s core differentiator is the family-team system, and original naming reduces ambiguity and intellectual-property risk.

## D-005 — Bend final duel

**Proposal:** Phase 2 is always a shadow mirror of the selected team. It copies the team’s weapon range and learned techniques with tuned reaction delays. The baseball-bat Shadow Link version is retired.

## D-006 — Save system

**Proposal:** MVP uses versioned `localStorage` saves with checkpoint autosaves and one manual “Save at Fridge” action. Password saves are deferred until the complete web game is stable.

**Reason:** A useful password encoding for this amount of state would be long and error-prone. It is more appropriate for a constrained ROM demake.

## D-007 — Budda rewards

**Proposal:** Each Budda location grants the location-specific reward listed in the table and triggers a full HP/MP restoration. The 30-second regeneration aura is granted only on the first sighting per zone.

**Reason:** This preserves the authored jokes and rewards while incorporating Section 10.3 without enabling unlimited stacking.

## D-008 — Internal rendering and UI

**Proposal:** The world renders at 256 × 240 with nearest-neighbor scaling. HUD, menus, dialogue, and touch controls may render in a responsive overlay at device resolution.

**Reason:** Pixel-art authenticity should not make text or controls inaccessible.

## D-009 — Team rollout

**Proposal:** Dad & Paula are the first production-ready team for the vertical slice. The other teams exist as validated data records and selection placeholders until the shared combat rig is stable.

**Reason:** Building five polished variants before validating movement and combat would multiply rework.

## D-010 — Canonical progression order

**Proposal:**

1. Rockaway Beach: Lantern and hub
2. Hillsboro West: Upthrust
3. Hillsboro East: JUMP
4. Milwaukie: Downthrust
5. Walla Walla: REFLECT
6. Bend: mastery trial and finale

Gates and map labels must follow this sequence.

## D-011 — Difficulty philosophy

**Proposal:** Preserve deliberate Zelda II-style combat spacing but add input buffering, coyote time, clear telegraphs, and forgiving checkpoints. No required frame-perfect actions.

**Reason:** The game is a family gift and must work with touch controls.

## D-012 — Content normalization

**Proposal:** Use lowercase machine IDs with consistent display labels:

- `relic_golden_thumb`
- `relic_crystal_hound`
- `relic_amber_stein`
- `relic_emerald_leaf`
- `relic_marble_mountain`
- `technique_upthrust`
- `technique_downthrust`
- `spell_jump`
- `spell_reflect`

Names such as Hilary, Cia, Kris, and Lea retain one approved capitalization everywhere.

## D-013 — Originality boundary

**Proposal:** Zelda II may inform the high-level two-mode structure and combat feel, but the project will use original sprites, audio, maps, dialogue, enemies, bosses, UI composition, and terminology.

## Approval checklist

Before implementation begins, confirm or amend:

- [ ] Web-first release; ROM demake later
- [ ] TypeScript/Vite/Phaser stack
- [ ] All five palaces remain playable for every selected team
- [ ] Selected team uses the “magical echo/support NPC” treatment in its own palace
- [ ] Shadow boss mirrors the selected team
- [ ] Password saves are deferred
- [ ] Budda reward combination is approved
- [ ] Dad & Paula lead the vertical slice
- [ ] Originality boundary is approved
