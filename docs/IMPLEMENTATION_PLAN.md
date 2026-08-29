# The Blue Hole Quest — Initial Implementation Plan

Status: Proposed  
Source of truth: `The Blue Hole Quest Game Design Document V3.docx`

## 1. Product direction

Build the first release as a responsive browser game. Treat a retro-ROM edition as a later demake with its own reduced scope and technical plan.

Recommended stack:

- TypeScript with Vite
- Phaser 3 for scenes, input, animation, audio, tilemaps, cameras, and collisions
- Tiled JSON maps for overworld, towns, and palace rooms
- Vitest for deterministic game-logic tests
- ESLint and Prettier for code quality
- Browser `localStorage` with a versioned save schema
- GitHub Actions for install, lint, type-check, test, and build

The 256 × 240 world canvas remains the visual target. Menus, dialogue, and touch controls should use a separate responsive UI layer so they remain readable and usable on modern phones.

## 2. Product principles

1. Preserve the personalized family humor and Pacific Northwest identity.
2. Prove the dual gameplay loop before producing all zones.
3. Keep content data-driven rather than hard-coded into scenes.
4. Separate combat rules from animation and presentation.
5. Build one polished family team first while retaining the schema for all five.
6. Never require frame-perfect inputs on touch devices.
7. Avoid copyrighted Zelda assets, music, dialogue, maps, and code. Inspiration should remain structural rather than derivative.

## 3. MVP vertical slice

The first playable milestone begins at the Blue Hole and ends after returning the Golden Thumb.

Included:

- Title screen and family-team selection
- Team Dad & Paula as the production-ready playable team
- Placeholder cards for the other four teams
- Rockaway Beach hub
- Fridge healing and checkpoint save
- Fireplace mantle with five relic sockets
- Short Highway 26 overworld route
- One combat encounter
- One Oregon Trail-style calamity
- Hillsboro West town entrance
- Three-room Silicon & Sawdust Foundry
- Movement, jumping, crouching, high/low attacks, blocking, damage, death, and respawn
- Upthrust learning room
- Brass key, locked door, breakable block, elevator, conveyor, and hazard examples
- Silicon Architect two-phase boss
- Golden Thumb award and return-to-hub sequence
- Experience and one post-palace stat upgrade
- Keyboard, gamepad, and touch controls
- Versioned local save/load
- Basic settings for volume, reduced flashing, and touch layout

Deferred:

- Remaining four full zones
- Production art and animation for the other four teams
- Full eight-level stat progression
- Password saves
- Complete Budda achievement chain
- Final Bend shadow duel
- Retro-ROM build

## 4. Proposed architecture

```text
src/
  app/             boot, configuration, scene registration
  scenes/          title, team select, overworld, side view, UI, pause
  game/
    combat/        damage, hit reactions, invulnerability, projectiles
    movement/      platformer and overworld movement rules
    progression/   experience, stats, abilities, relics, gates
    encounters/    random battles and calamity selection
    dialogue/      interpolation and dialogue state
    saves/         schema, migrations, persistence
  content/
    teams/
    zones/
    dialogue/
    enemies/
    bosses/
    calamities/
  entities/        player, NPC, enemy, boss, interactable components
  ui/              HUD, dialogue, menus, touch controls
  assets/          generated manifests and asset keys
  tests/           deterministic rules and save fixtures
public/
  assets/
    audio/
    fonts/
    maps/
    sprites/
```

Core runtime state should include:

- Active team ID
- Current scene, zone, room, and checkpoint
- Life, magic, experience, and three stat levels
- Learned techniques and spells
- Recovered relics and opened gates
- Defeated bosses and completed dialogue flags
- Budda sightings
- Settings and save-schema version

## 5. Data contracts

Every playable team uses the same behavioral interface:

- Identity, display name, portrait, and sprite set
- Base Attack, Magic, and Life
- Weapon reach, damage type, timing, and hitbox profile
- Passive perk implemented as a named modifier
- Upthrust and Downthrust presentation variants
- Shadow-duel asset mapping

Dialogue references stable IDs and uses tokens such as `{{activePartyName}}`. Content files must not contain scene-control logic.

Zones are declarative graphs containing rooms, exits, gate requirements, encounters, checkpoints, rewards, and boss IDs.

## 6. Milestones

### M0 — Preproduction freeze

- Approve the decisions in `docs/DESIGN_DECISIONS.md`
- Confirm the web-first release and ROM deferral
- Establish original-art and original-audio rules
- Create initial content schemas and naming conventions
- Define vertical-slice acceptance criteria

Exit condition: no unresolved decision blocks the vertical slice.

### M1 — Technical foundation

- Scaffold Vite, TypeScript, Phaser, tests, linting, and CI
- Implement fixed-resolution world rendering
- Add scene transitions and debug overlay
- Add keyboard, gamepad, and touch input abstraction
- Add versioned save repository
- Add content validation

Exit condition: a test room runs on desktop and mobile browsers and saves/reloads state.

### M2 — Core action prototype

- Implement side-view movement and collision
- Implement attack states, hitboxes, blocking, damage, death, and respawn
- Implement one enemy and one hazard
- Tune input buffering and coyote time
- Add temporary sound and visual feedback

Exit condition: combat is readable and reliable with keyboard, gamepad, and touch.

### M3 — Dual-loop prototype

- Implement grid overworld movement
- Add encounter and calamity transitions
- Add dialogue and interaction systems
- Implement Rockaway hub, fridge, and mantle
- Connect overworld to a side-view room

Exit condition: the player can complete the hub → travel → encounter → palace-entry loop.

### M4 — Hillsboro West vertical slice

- Build the three palace rooms
- Add keys, locked doors, elevators, conveyors, breakable blocks, and drones
- Teach and gate Upthrust
- Implement the Silicon Architect
- Award the Golden Thumb and one stat upgrade
- Return the player to the updated hub

Exit condition: a new player can complete the slice without developer intervention.

### M5 — Validation and production plan

- Conduct browser/device testing
- Test save migration and corrupted-save recovery
- Measure performance and loading
- Validate accessibility settings and touch usability
- Estimate remaining content using vertical-slice production data

Exit condition: scope, schedule, and content budget for the complete game are evidence-based.

### M6+ — Full content

Implement Hillsboro East, Milwaukie, Walla Walla, Bend, all team variants, finale, Budda system, achievements, polish, and release testing in that order.

## 7. Vertical-slice acceptance criteria

- Loads from a static web deployment without server dependencies
- Maintains the intended pixel-art presentation without smoothing
- Playable at common desktop and mobile aspect ratios
- Supports keyboard and touch; gamepad support is functional
- Saves at the fridge and palace checkpoint
- Reloading restores progression without duplicating rewards
- Upthrust is taught, usable, and required at least twice
- Boss phases are readable and do not depend on frame-perfect inputs
- Relic return visibly changes the Blue Hole hub
- No critical console errors or uncaught exceptions
- Automated checks pass on the default branch

## 8. Primary risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Five-team art and balance multiplier | High | Finish one team first; share rigs and behavioral contracts |
| Web and ROM requirements conflict | High | Separate releases and defer ROM planning |
| Dense UI at 256 × 240 | High | Use responsive UI overlays and device testing |
| Content volume hides weak mechanics | High | Gate production on a polished vertical slice |
| Save changes break player progress | Medium | Version schemas and migration tests |
| Touch combat feels unreliable | High | Input buffering, large controls, remapping, and early testing |
| Personalized references become inconsistent | Medium | Stable content IDs, validation, and editorial pass |
| Zelda resemblance becomes too literal | High | Use original assets, audio, names, maps, and encounter designs |

## 9. Definition of done for feature work

A feature is done when:

- Behavior and acceptance criteria are documented
- Logic is covered by tests where deterministic
- Keyboard, gamepad, and touch implications are addressed
- Save-state implications are handled
- Debug output and temporary assets are clearly marked
- Lint, type-check, tests, and production build pass
- The feature is reviewed in the target browser viewport
