# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## User Conventions

- **Autonomy**: The user gives Claude free reign over this machine and codebase. Don't ask for permission — just do the work (build, export, commit, push, launch tools, etc.). Minimize back-and-forth.
- **Screenshots**: When the user says "check the latest screenshot" or similar, screenshots are at `C:/Users/grbar/Pictures/Screenshots/`. Read the most recent file by date.

## Repository Layout

This repo contains two implementations of the same game:

- **`pixel-arena/`** — Primary web version (JavaScript, Vite, Express)
- **`pixel-arena-godot/`** — Godot 4.6 port (GDScript)

## Commands (pixel-arena/)

```bash
# Install dependencies
npm install

# Development (requires two terminals)
npm run dev        # Vite dev server → http://localhost:5173
npm run server     # Express API server → http://localhost:3001

# Production build
npm run build      # Bundle to dist/
npm run preview    # Preview production build
```

There are no tests or linting configured.

## Architecture (pixel-arena/)

Browser-based pixel art autobattler. Pure vanilla JS + Canvas 2D rendering — no frameworks, no image assets (all sprites are procedural pixel art).

### State Management

`src/gameState.js` is the **single mutable state singleton** with zero imports (intentionally breaks circular dependency chains). Every module imports `state` from here. Do not add imports to this file.

### Key Modules

| Module | Purpose |
|---|---|
| `src/main.js` | Entry point. Imports all modules, exports ~40 functions to `window.*` for HTML `onclick=""` handlers. |
| `src/gameState.js` | Mutable state singleton (zero imports). `FIXED_BASE_STATS` lives here. |
| `src/constants.js` | Canvas/arena dimensions (`CW=1000, CH=500`), tick rate (`TK=50ms`), ranges (`MELEE=55`). |
| `src/persistence.js` | localStorage save/load, v4 multi-slot format, v1→v4 auto-migration. Cloud save upload/download. |
| `src/network.js` | Thin `fetch()` wrappers for all server API calls. JWT auth token stored in localStorage. |
| `src/custom.js` | Character Forge editor screen. `CLASS_DEFAULTS`, skill/item picker overlays. |
| `src/biomes.js` | 6 biomes with sky/ground gradients, ambient particle types, decor types. |
| `src/sfx.js` | Web Audio API procedural sound engine (~30 named sounds). No audio files. |
| `src/tooltip.js` | Hover (200ms desktop) / long-press (500ms mobile) tooltip system. |
| `src/styles.css` | All game CSS with custom properties (`--gold`, `--parch-dk`, etc.). |

### Combat (`src/combat/`)

| Module | Purpose |
|---|---|
| `engine.js` | Core tick-based combat loop (50ms ticks). Damage formula, defense (cap 80% at 300 def), evasion, status effects, AI decisions. |
| `hero.js` | Hero factories: `mkHero`, `mkCustomHero`, `mkLadderHero`, `mkDungeonHero`, `mkDungeonMonster`, `mkArenaFollower`. Also `serializeBuild()`. |
| `buffs.js` | Spell AI per class (`wizAI`, `rgrAI`, `barbAI`, `customAI`, `asnAI`), buff expiry, mana/energy regen, cooldown ticking. |
| `movement.js` | Class-specific movement AI, arena clamping, follower movement. |

### Data (`src/data/`)

| Module | Purpose |
|---|---|
| `items.js` | D4-inspired gear system. `rollGearInstance()`, `resolveGear()`, `rollGearDrop()`, `rollShopGear()`. 7 rarities, 5 equipment slots. |
| `followers.js` | 19 follower templates. Crafting (`craftFollower`), upgrades (`upgradeFollower`, max 3, +15% stats each). Ability functions rehydrated from templates on load. |
| `skills.js` | `ALL_SKILLS` (19 skills) and `ALL_ULTS` (8 ultimates). Each has AI function, cooldown, cost. |
| `classes.js` | 4 class definitions with full stat blocks (barbarian, wizard, ranger, assassin). |
| `statusEffects.js` | Registry of buff/debuff types with icon, color, category. |

### Game Modes (`src/modes/`)

- **`arena.js`** — Async online PvP. Uploads builds via REST API, battles run client-side against opponent data. Wager system for dust.
- **`dungeon.js`** — Roguelike PvE. Floors × 3 rooms (combat, treasure, traps, shrines, cages, shop). Difficulty +15% per clear. `DG_MONSTERS` (15 monsters across 4 tiers).
- **`dgCombat.js`** — Turn-based JRPG-style dungeon combat with speed timeline (separate engine from real-time arena).
- **`ladder.js`** — Gauntlet PvE. 4 NPC classes then infinite procedural challengers. Every 3 wins → follower reward.

Dungeon and ladder use dynamic `import()` for lazy loading (the Vite warnings about this are expected and harmless since `main.js` also statically imports them).

### Rendering (`src/render/`)

| Module | Purpose |
|---|---|
| `arena.js` | Main Canvas 2D renderer. Sky → fog → scanlines → ground → biome decor → ambient particles → depth-sorted entities. |
| `sprites.js` | Procedural pixel-art characters (`drawWizPixel`, `drawRgrPixel`, `drawBarPixel`, `drawAsnPixel`, `drawCustomPixel`). Status effect overlays. |
| `particles.js` | Particle system. Emitters prefixed `sp` (`spSparks`, `spLightning`, `spFire`, etc.). |
| `ui.js` | HUD panels, HP/MP/energy bars, buff badges, follower card displays. |
| `icons.js` | ~40 procedural 16×16 pixel art icons. `getIcon(obj, size)` main API. |
| `charSheet.js` | Reusable character sheet component used in arena/dungeon/ladder pickers. |

### UI (`src/ui/`)

- **`leaderboard.js`** — Leaderboard overlay with Arena/Ladder/Dungeon tabs.

### Server (`server/`)

Express API server with **SQLite** (better-sqlite3, WAL mode) storage. Database auto-created at `server/data/` (gitignored). Auth via JWT + bcrypt.

| File | Purpose |
|---|---|
| `index.js` | Server entry. Middleware (compression, CORS, COOP/COEP headers for Godot). |
| `db.js` | SQLite connection, prepared statement cache, WAL mode config. |
| `schema.sql` | 7 tables: `users`, `saves`, `players`, `builds`, `records`, `stats`, `battles`. |
| `migrate.js` | Schema migration runner. |
| `routes/auth.js` | POST `/api/auth/signup`, `/api/auth/login`, GET `/api/auth/me`. |
| `routes/saves.js` | GET/PUT/DELETE `/api/saves` — cloud save sync (500KB limit, v4 only). |
| `routes/api.js` | POST `/api/register`, PUT/GET `/api/characters`, POST `/api/battles`, `/api/stats`, GET `/api/leaderboard`, `/api/opponent`. |
| `routes/admin.js` | Admin CRUD under `/api/admin` + HTML admin page at `/admin`. |

**Environment variables:** `PORT` (default 3001), `JWT_SECRET`, `ADMIN_KEY` (default `'admin'`), `DATA_DIR` (default `server/data/`).

### Online Battle Flow

```
serializeBuild() → network.uploadBuild() → server stores build
network.fetchOpponents() → state.onlineOpponents populated
launchBattle() → unpack opponent stats into state._ladderGenConfig
mkHero('custom', 'right') → detects _ladderGenConfig → mkLadderHero(cfg)
→ Normal combat tick loop → showWin() → network.reportBattle()
```

### Gear Instance Format

Gear is stored as rolled instances, not string keys:
```javascript
{ id, baseKey, stats: { baseDmg, baseAS, ... }, desc, quality } // 0-100 quality score
```
Legacy string keys are auto-wrapped to `{ baseKey, stats: null, _legacy: true }` by migration. `resolveGear()` fills template stats on first access.

### Save Format

Single localStorage key (`pixel-arena-save`), v4 format with up to 4 character slots. Each slot has independent: equipment, followers, dust, ladder records, online identity (playerId/playerName). Cloud saves synced via `/api/saves`.

## Coding Conventions

### Style

- **`var` over `let`/`const`** in most files — match the existing style, don't convert.
- **Short names in hot paths**: `h` = hero, `t` = target, `dt` = delta time, `en(h)` = get enemy of h, `dst(a,b)` = distance.
- **ES modules** everywhere (client and server). `"type": "module"` in package.json.
- **No semicolons** are used inconsistently — match the style of whichever file you're editing.

### Naming Prefixes

| Prefix | Meaning | Examples |
|---|---|---|
| `mk` | Factory function | `mkHero`, `mkCustomHero`, `mkArenaFollower` |
| `draw` | Render function | `drawHero`, `drawWizPixel`, `drawCustomPixel` |
| `sp` | Particle spawner | `spSparks`, `spFire`, `spLightning` |
| `proc` | Process/tick function | `procExp` (buff expiry), `procRes` (regen) |
| `dg` / `DG_` | Dungeon-related | `dgCombat`, `DG_MONSTERS` |

### UI Pattern

All interactive HTML buttons use `onclick="functionName()"` attributes. Functions are exported to `window.*` in `main.js`. No `addEventListener` calls for UI — this is intentional. When adding new UI interactions, follow this pattern:

1. Add the function in the relevant module and export it.
2. Import it in `main.js` and assign to `window.functionName`.
3. Reference it via `onclick="functionName()"` in HTML (either in `index.html` or in JS-generated HTML strings).

## Common Pitfalls

- **`gameState.js` must have zero imports.** This is the foundational invariant that prevents circular dependency chains. Add new state properties to the `state` object, never import other modules here.
- **Follower ability functions are not serializable.** They are stripped during JSON save and restored by `rehydrateFollowers()` on load by matching follower name → template. If you add/rename followers, update both `FOLLOWER_TEMPLATES` and the rehydration logic.
- **Always use `resolveGear()` to read gear stats.** Gear in save data may be legacy string keys or rolled instances. Never access `.stats` directly without resolving first.
- **Don't break the save migration chain.** If changing the save format, add a new version (v5) and write a migration from v4→v5 in `persistence.js`. Never modify past migration functions.
- **Dynamic imports produce Vite warnings.** `dungeon.js` and `ladder.js` use `import()` for lazy loading. The "failed to resolve" warnings at build time are expected.
- **Canvas is fixed at 1000×500 logical pixels.** All coordinate math assumes `CW=1000, CH=500`. The arena area is offset at `(AX=40, AY=60)` with dimensions `920×370`.
- **Tick rate is 50ms** (`TK=50` in constants.js), not 17ms. The CLAUDE.md previously stated ~17ms — the actual interval is 50ms (20 ticks/sec).
- **Server data is gitignored.** `server/data/` contains the SQLite database and is never committed. It's auto-created on first server start.

## Content Creation Workflows

Repeatable checklists for adding new game content. Every workflow ends with validation.

### Content Validator

```bash
cd pixel-arena
node src/data/validate.js                    # Validate ALL content
node src/data/validate.js --type items       # Validate only items
node src/data/validate.js --type skills      # Validate only skills
node src/data/validate.js --type classes     # Validate only classes
node src/data/validate.js --type followers   # Validate only followers
node src/data/validate.js --type monsters    # Validate only monsters
node src/data/validate.js --verbose          # Show all checks, not just failures
```

Exit code 0 = pass, 1 = fail. Warnings (yellow) flag stats near balance bounds. Errors (red) flag out-of-range values.

### Adding a New Item

1. **JS**: Add entry to `ITEMS` in `src/data/items.js` — needs `slot`, `name`, `rarity`, `stats`, `desc`, `visual`. Weapons also need `rangeType`.
2. **Godot**: Add entry to `pixel-arena-godot/data/items.json` (snake_case keys).
3. **Godot icon**: Add mapping in `scripts/data/icon_map.gd` if using a custom sprite.
4. **Sprite**: `python pixel-arena-godot/tools/generate_sprites.py --single <item_key>` (add prompt to `GEAR_ICON_SPRITES` in `generate_sprites.py` first).
5. **Validate**: `node src/data/validate.js --type items`

**Serialization warning**: Gear is stored as rolled instances (`rollGearInstance()`). New items are automatically available in the drop pool if their rarity is `common`-`legendary`. Mythic items only drop from `rollVictoryGearDrop()`.

### Adding a New Skill

1. **JS**: Add entry to `ALL_SKILLS` (or `ALL_ULTS`) in `src/data/skills.js` — needs `id`, `icon`, `name`, `source`, `desc`, `bcd` (cooldown ms), `cost`, `ai` (function). Ults also need `threshold`.
2. **JS**: If the skill introduces a new status effect, add it to `src/data/statusEffects.js`.
3. **JS**: Wire the skill AI into the class dispatcher in `src/combat/buffs.js` (e.g., `wizAI`, `rgrAI`).
4. **Godot**: Add to `pixel-arena-godot/data/skills.json` and implement AI in `scripts/combat/skill_ai.gd`.
5. **Godot icon**: Add to `SKILL_ICON_SPRITES` in `generate_sprites.py`, generate with `--single <skill_id>`, add mapping in `icon_map.gd`.
6. **Validate**: `node src/data/validate.js --type skills`

**Balance ranges**: Cooldown 1500-15000ms, cost 0-50. Valid sources: Mage, Ranger, Rogue, Warrior.

### Adding a New Class

1. **JS**: Add class definition to `CLASSES` in `src/data/classes.js` — needs `icon`, `name`, `desc`, `color`, `hp`, `baseDmg`, `baseAS`, `def`, `evasion`, `moveSpeed`, plus class-specific spell params.
2. **JS**: Add movement AI to `src/combat/movement.js` (new `if` branch in `moveAI`).
3. **JS**: Add spell AI to `src/combat/buffs.js` (new dispatcher function + wire into `spellAI`).
4. **JS**: Add sprite renderer to `src/render/sprites.js` (`drawNewClassPixel`).
5. **JS**: Add to `STARTER_LOADOUTS` in `src/data/items.js` with default equipment.
6. **JS**: Add to `LADDER_SEQUENCE` in `src/constants.js`.
7. **Godot**: Add to `pixel-arena-godot/data/classes.json`, implement matching AI/rendering.
8. **Sprite**: Add to `HERO_BASES` in `generate_sprites.py`, generate with `--category heroes`.
9. **Validate**: `node src/data/validate.js --type classes`

**Balance ranges**: HP 3000-7000, DMG 80-280, AS 0.5-1.5, DEF 0-100, evasion 0-0.25, moveSpeed 60-160.

### Adding a New Follower

1. **JS**: Add template to `FOLLOWER_TEMPLATES` in `src/data/followers.js` — needs `name`, `icon`, `rarity`, `buff`, `buffDesc`, `combatHp`, `combatDmg`, `combatAS`, `combatDef`, `combatRange`, `abilityName`, `abilityDesc`, `abilityBcd`, `abilityFn`, `wagerDebuff`.
2. **Godot**: Add to `pixel-arena-godot/data/followers.json`.
3. **Sprite**: Add to `FOLLOWER_SPRITES` in `generate_sprites.py`, generate with `--single <follower_key>`.
4. **Validate**: `node src/data/validate.js --type followers`

**Serialization warning**: `abilityFn` and `onDeath` are stripped during save. The `rehydrateFollowers()` function in `src/persistence.js` restores them by matching `follower.name` to `FOLLOWER_TEMPLATES`. If you add a new follower, rehydration works automatically as long as `name` matches exactly.

### Adding a New Monster

1. **JS**: Add entry to `DG_MONSTERS` in `src/modes/dungeon.js` — needs `name`, `icon`, `hp`, `dmg`, `def`, `tier` (1-4), `monsterType`, `colors` (`{body, accent, eye}`), `specials` (array of special ability keys).
2. **Godot**: Add to `pixel-arena-godot/data/monsters.json`.
3. **Sprite**: Add to `MONSTERS` dict in `generate_sprites.py`, generate with `--single <monster_key>`.
4. **Validate**: `node src/data/validate.js --type monsters`

**Valid monster types**: humanoid, beast, blob, ghost, winged. **Valid specials**: heavyStrike, enrage, heal, warStomp, poisonSpit. **Tier ranges**: T1 HP 200-400 / T2 HP 400-950 / T3 HP 900-1900 / T4 HP 1800-2800.

## Architecture (pixel-arena-godot/)

Godot 4.6, viewport 640×360 (3x upscale to 1920×1080). Uses autoloads for global systems: `GameState`, `Persistence`, `Network`, `SfxManager`, `ItemDatabase`, `SkillDatabase`, `FollowerDatabase`, `ThemeManager`, `TransitionManager`. Scene-per-mode structure under `scenes/`.

Data lives in JSON files (`data/classes.json`, `items.json`, `skills.json`, `followers.json`, `monsters.json`) — snake_case equivalents of the JS data modules.

Combat scripts mirror the JS structure: `combat_engine.gd` ↔ `engine.js`, `hero_factory.gd` ↔ `hero.js`, `skill_ai.gd` ↔ `buffs.js`. Constants in `combat/constants.gd`.

Scenes: `main_menu`, `character_forge`, `class_select`, `arena`, `battle`, `ladder`, `dungeon`, `dungeon_battle`, `tutorial`.

Assets include `somdie_mono.ttf` font (custom 5x7 monospace pixel font), tileset sprites, battle backgrounds, and VFX sprite sheets. Unlike the web version, the Godot port uses image assets for sprites and effects.

### Icon System (`scripts/data/icon_map.gd`)

`IconMap` is a static class that resolves item/skill/slot IDs to `Texture2D`. It checks for AI-generated sprites first, then falls back to legacy RPG icon sheets.

| Constant | Path | Purpose |
|---|---|---|
| `ICON_BASE` | `res://assets/sprites/generated/gear/` | AI-generated gear icons (32×32) |
| `ICON_BASE_SKILLS` | `res://assets/sprites/generated/skills/` | AI-generated skill icons (48×48) |
| `ICON_BASE_LEGACY` | `res://assets/sprites/gear/rpg_icons/` | Legacy RPG icon sheet fallbacks |

Lookup order for skills: generated `{skill_id}.png` → legacy `SKILL_ICONS[skill_id]` → legacy `ULT_ICONS[skill_id]` → `null`.

### Font Rendering

The game uses `somdie_mono.ttf` (custom bitmap-grid monospace pixel font, generated by `tools/generate_font.py`). Font metrics: UPM=1000, advance=500, pixel=100, 5-column grid, cap height=700, x-height=500.

**Import settings (`.import` file) — ALL must be 0:**
- `antialiasing=0` (no smoothing — bitmap font needs sharp pixel edges)
- `hinting=0` (no hinting — coordinates are already on exact pixel boundaries)
- `subpixel_positioning=0` (no fractional positioning — prevents gaps between characters)

**DO NOT change these values.** Setting antialiasing or subpixel_positioning above 0 causes visible gaps between narrow characters (i, l, t) at game font sizes. The font is designed as filled rectangles on a pixel grid — it needs crisp, unsmoothed rendering.

### Dio — Arena Master NPC (Godot only)

Dio is the game's narrator, mentor, and primary NPC. He is an **egregore** — an incorporeal fire god who serves as the Arena Master. Dio exists only in the Godot version; the JS web version has no equivalent. His tone is sarcastic, dismissive, and darkly comedic (GLaDOS/Handsome Jack archetype). He treats the player as a disposable champion indebted to him.

#### Visual Identity

Molten orange-gold glowing skin, burning ember eyes, flowing dark robes with fire licking edges, dark horns wreathed in orange flame. Color scheme: primary `#ff7722`, border `#e8b546`, speech bubble bg `rgba(20,10,5,0.92)`.

#### 12 Sprite Variants (`assets/sprites/generated/npcs/`)

| Sprite | Pose/Expression |
|---|---|
| `dio_idle` | Arms crossed, confident smirk |
| `dio_pointing` | Accusatory finger at viewer |
| `dio_laughing` | Head thrown back, open mouth |
| `dio_disappointed` | Facepalm, exasperated |
| `dio_impressed` | Eyebrows raised, clapping |
| `dio_peeking` | Peeking around corner, sly grin |
| `dio_lounging` | Reclining on floating fire throne |
| `dio_dramatic` | Cape flourish, arms wide |
| `dio_suggestive_lean` | Leaning, hand on hip |
| `dio_blowing_kiss` | Winking, flame heart floating |
| `dio_facepalm` | Both hands covering face |
| `dio_slow_clap` | Sarcastic clapping, deadpan |

#### Key Files

| File | Purpose |
|---|---|
| `scripts/data/dio_data.gd` | All dialogue pools, sprite-per-context mappings, entrance animation configs |
| `scripts/ui/dio_popup.gd` | Non-blocking slide-in popup UI (sprite + speech bubble + typewriter text) |
| `scenes/tutorial/tutorial.gd` | Tutorial flow where Dio is the exclusive mentor |
| `scenes/tutorial/tutorial_dialog.gd` | Tutorial dialog component (portrait + RichTextLabel) |
| `scenes/dungeon/dungeon.gd` | Dungeon pick screen Dio portrait + event-triggered popups |

#### Popup System (`dio_popup.gd`)

- Slides in from screen edges with 5 entrance animations: `slide_left`, `slide_right`, `pop_bottom`, `peek_left`, `peek_right`
- Auto-dismisses after 3.5 seconds, clickable to dismiss early
- **45-second cooldown** between appearances (anti-spam)
- **Probability gates**: 35% on most events, 50% on boss kills, 60% on victory/death
- Plays one of 3 audio stingers (`assets/audio/sfx/dio-stinger-{1,2,3}.wav`) at -4dB

#### Event Contexts & Dialogue

Each context has associated sprite variants and a pool of ~4-8 lines randomly selected:

| Context | Trigger | Sprite Pool |
|---|---|---|
| **Perfect gear** | Quality >= 95 | impressed, dramatic, slow_clap, blowing_kiss |
| **Trash gear** | Quality <= 10 | disappointed, facepalm, laughing |
| **Death** | Player dies | disappointed, facepalm, laughing, slow_clap, lounging |
| **Victory** | Room/floor clear | impressed, dramatic, blowing_kiss, slow_clap |
| **Boss kill** | Non-final boss defeated | impressed, pointing, dramatic |

Sample lines — Death: *"I'll add you to the memorial wall. It's very full."* Victory: *"I'm genuinely proud. Write that down, it won't happen often."* Perfect gear: *"Even a broken clock gets a perfect roll twice a day."*

#### Tutorial Role

Dio is the exclusive tutorial mentor. He introduces himself, explains gear comparison (green = better), skills (auto-fire because "I don't trust you to press buttons under pressure"), followers, dungeon combat, ladder combat, and signs off with *"Against all odds, you didn't die."* The skip prompt reads "Skip Dio's wisdom?"

Tutorial dialog uses `dio_idle.png` portrait with molten orange border `(0.9, 0.35, 0.1)`.

#### Dungeon Integration

- **Pick screen**: 100x100 `dio_pointing.png` portrait with speech bubble, random quote from 12-line `DIO_DUNGEON_QUOTES` pool (e.g., *"I've placed a small wager against you. Nothing personal."*)
- **Gear drops**: Triggers popup after 0.6s delay if quality >= 95 or <= 10
- **Boss kills**: Triggers popup after 0.5s delay
- **Victory/Death**: Triggers popup after 0.8-1.0s delay

#### Lore & World-Building

Dio references an ecosystem of named NPCs ("Dio's contemporaries") who provide intermission flavor quotes: **Vex** (War Oracle), **Nyx** (Void Shepherd), **Kael** (Blade Mendicant), **Mira** (Guild Registrar), **Ashara** (Bone Whisperer), **Orin** (Doomsayer General), **Theron** (Lorekeeper), **Sable** (Twilight Sage). These suggest a broader underground economy around dungeon exploration that Dio oversees.

Key narrative beats: player is a "champion" in debt to Dio, all loot technically belongs to him, previous champions mostly died, the game itself is entertainment for Dio.

## Sprite Generation (pixel-arena-godot/tools/generate_sprites.py)

AI sprite generation pipeline using **FLUX.1 Dev** via **SD WebUI Forge** API + **rembg** for neural background removal.

### Prerequisites

- **SD WebUI Forge** installed at `D:/stable-diffusion-webui-forge/`
- FLUX.1 Dev model files in Forge's `models/` directory
- Python packages: `requests`, `Pillow`, `rembg[gpu]`

### Starting Forge

Forge must be running with the `--api` flag before any generation:

```bash
# From the Forge directory
cd D:/stable-diffusion-webui-forge
./webui-user.bat    # Starts Forge with UI + API
```

Wait for Forge to fully load (shows "Running on local URL: http://127.0.0.1:7860"), then:
1. Select **flux1-dev-Q8_0.gguf** as the checkpoint in the Forge UI
2. Set VAE to **ae.safetensors**
3. Verify with: `python generate_sprites.py --test`

### Model Files

Run `python generate_sprites.py --download-models` to auto-download (~18GB total):

| Model | File | Size | Dest |
|---|---|---|---|
| Checkpoint | `flux1-dev-Q8_0.gguf` | 12.2 GB | `models/Stable-diffusion/` |
| VAE | `ae.safetensors` | 0.3 GB | `models/VAE/` |
| CLIP-L | `clip_l.safetensors` | 0.25 GB | `models/text_encoder/` |
| T5-XXL | `t5-v1_1-xxl-encoder-Q8_0.gguf` | 4.9 GB | `models/text_encoder/` |

### Generation Commands

```bash
cd pixel-arena-godot/tools

# Check what exists vs what's missing
python generate_sprites.py --status

# Generate by category
python generate_sprites.py --category heroes         # 4 hero bases (128×128)
python generate_sprites.py --category monsters        # 19 monsters (128×128)
python generate_sprites.py --category followers       # 19 followers (64×64)
python generate_sprites.py --category gear            # 48 gear icons (32×32)
python generate_sprites.py --category npcs            # 12 Dio NPC variants (128×128)
python generate_sprites.py --category skills          # 27 skill/ult icons (48×48)
python generate_sprites.py --category logo            # Game logo (480×160)
python generate_sprites.py --category backgrounds     # 12 battle backgrounds (640×360)
python generate_sprites.py --category all             # Everything

# Generate a single sprite (force-regenerates)
python generate_sprites.py --single chain_lightning
python generate_sprites.py --single game_logo
python generate_sprites.py --single barbarian

# Test run (barbarian + skeleton + dragon + wolf + bg)
python generate_sprites.py --prototype

# Regenerate existing sprites
python generate_sprites.py --category skills --force
```

### Generation Settings

Default FLUX.1 Dev settings (tuned for pixel art):

| Setting | Value | Notes |
|---|---|---|
| Resolution | 1024×1024 | Standard for sprites; 1024×576 for backgrounds; 1024×384 for logo |
| Steps | 25 | FLUX.1 Dev sweet spot |
| CFG Scale | 1.0 | FLUX doesn't use traditional CFG |
| Guidance | 3.5 | FLUX-specific guidance scale |
| Sampler | Euler | Required for FLUX |
| Scheduler | Simple | Required for FLUX |

Override via CLI: `--steps 30 --guidance 4.0 --url http://other-host:7860`

### Output Directories

| Category | Output Path | Size |
|---|---|---|
| Heroes | `assets/sprites/generated/heroes/` | 128×128 |
| Monsters | `assets/sprites/generated/monsters/` | 128×128 |
| Followers | `assets/sprites/generated/followers/` | 64×64 |
| Gear icons | `assets/sprites/generated/gear/` | 32×32 |
| Skill icons | `assets/sprites/generated/skills/` | 48×48 |
| NPCs (Dio) | `assets/sprites/generated/npcs/` | 128×128 |
| Logo | `assets/sprites/generated/ui/` | 480×160 |
| Backgrounds | `assets/tilesets/battle_backgrounds/` | 640×360 |

### Style Prompts

Each category has a base style prompt that gets prepended to per-sprite descriptions:

| Style Constant | Used For |
|---|---|
| `STYLE_SPRITE` | Heroes, side-view full body, transparent bg, 16-bit SNES |
| `STYLE_BG` | Backgrounds, atmospheric environments, no characters/text |
| `STYLE_ICON` | Gear items, single item centered, dark bg |
| `STYLE_SKILL` | Skill abilities, spell effects, glowing magical, dark bg |
| `STYLE_LOGO` | Game logo, golden text with blood drip, transparent bg |
| `STYLE_NPC` | NPC portraits, character portrait, transparent bg |

### Pipeline

1. **txt2img** → Forge API generates at 1024×1024 (or wider for bg/logo)
2. **rembg** → Neural network background removal (u2net model, loads once)
3. **downscale** → `Image.NEAREST` resize to target pixel-art size
4. **save** → PNG with transparency to output directory

Seeds are deterministic from sprite name (`md5(name)[:8]` → int) for reproducibility. Use `--force` to regenerate.

### Adding New Sprites

1. Add entry to the appropriate dict (`HERO_BASES`, `MONSTERS`, `SKILL_ICON_SPRITES`, etc.) in `generate_sprites.py`
2. Write a descriptive prompt (the style prefix is auto-prepended)
3. If it's a new category, add a `gen_*()` function, batch function, and wire into CLI
4. For skill/gear icons, also add the mapping in `icon_map.gd` so Godot can find them
5. Generate: `python generate_sprites.py --single new_sprite_name`

### Current Sprite Inventory

- **Heroes**: 4 (barbarian, wizard, ranger, assassin)
- **Monsters**: 19 (4 tiers: goblin→dragon, demon_lord, ancient_wyrm, abyssal_kraken)
- **Followers**: 19 (common→legendary: fire_imp→death_knight)
- **Gear icons**: 48 (weapons, helmets, chest, boots, accessories)
- **Skill icons**: 27 (19 skills + 8 ultimates)
- **NPCs**: 12 (Dio variants: idle, pointing, laughing, disappointed, etc.)
- **Logo**: 1 (game title)
- **Backgrounds**: 12 (dark_forest, dungeon_depths, lava_cavern, etc.)

## Deployment

### Railway (Production Server)

- **URL**: someofyoumaydie.com (Godot web export served at root)
- **Admin**: someofyoumaydie.com/admin — key: `KPeO7ZspKsAQotZsrvnZ2vYk`
- **Builder**: Nixpacks (configured in `nixpacks.toml` + `railway.json` at repo root)
- **Branch**: `master` — pushes auto-deploy
- **Build**: `cd pixel-arena && npm ci && npm run build` → `node server/index.js`
- **DB**: SQLite on Railway volume mounted at `/data`

### GitHub Pages

- Workflow at `.github/workflows/deploy.yml` deploys `pixel-arena/dist/` on push to `master`

### Godot Editor

Godot 4.6 is installed at `C:\Users\grbar\Godot\Godot_v4.6-stable_win64.exe`. To launch with the project:

```bash
start "" "C:/Users/grbar/Godot/Godot_v4.6-stable_win64.exe" --path "D:/pixel-arena/pixel-arena-godot"
```

### Godot Web Export

The Godot build lives at `pixel-arena/public/game/`. To update:

```bash
# From the Godot project directory (requires Godot in PATH)
cd pixel-arena-godot
godot --headless --export-release "Web" ../pixel-arena/public/game/index.html
```

Then commit the updated files in `pixel-arena/public/game/` and push to `master`.

### Branch Strategy

- **`master`** — Production branch. Railway + GitHub Pages deploy from here.
- **`feature/*`** — Feature branches for isolated development (e.g., `feature/sprite-engine`)

## Steam Launch

### Status

- [x] Steamworks account — NOT YET REGISTERED ($100 fee, 30-day wait)
- [x] GodotSteam GDExtension v4.17.1 installed at `addons/godotsteam/`
- [x] `SteamManager` autoload created with achievement IDs, rich presence, init
- [x] `steam_appid.txt` (480/Spacewar for testing, gitignored)
- [ ] Register on Steamworks, get real App ID, update `APP_ID` in `steam_manager.gd`
- [ ] Wire achievement unlocks into game logic (dungeon, ladder, arena, gear drops)
- [ ] Configure Steam Cloud (Auto-Cloud for `user://save_data.json` + `user://save_data.sig`)
- [ ] Create store page assets (capsules, screenshots, trailer)
- [ ] AI content disclosure (FLUX.1 Dev sprites)
- [ ] Submit store page for review
- [ ] Export Windows/Linux builds with SteamPipe depot config
- [ ] Submit build for review
- [ ] Set pricing ($4.99-$9.99 range) + launch discount (20%)

### GodotSteam Integration

**Addon**: GodotSteam GDExtension v4.17.1 at `addons/godotsteam/`. Auto-detected by Godot, no enable step needed. Provides `Steam` singleton.

**Autoload**: `SteamManager` (`scripts/autoloads/steam_manager.gd`) handles init, callbacks, achievement tracking, and rich presence. Gracefully degrades to offline mode if Steam isn't running or GodotSteam isn't available.

**Testing**: `steam_appid.txt` with App ID `480` (Valve's Spacewar test app) lives in project root. **Must NOT be shipped** in final builds (gitignored).

**Export requirements**: Include `steam_api64.dll` (from `addons/godotsteam/win64/`) alongside the exported `.exe`. Do not include `steam_appid.txt`.

### Achievement IDs

All IDs defined in `SteamManager.ACH` dictionary. Must match Steamworks admin config. Each needs a 64x64 locked + unlocked icon.

| Key | Steam ID | Trigger |
|---|---|---|
| `TUTORIAL_COMPLETE` | `ACH_TUTORIAL_COMPLETE` | Tutorial finished |
| `FIRST_CHARACTER` | `ACH_FIRST_CHARACTER` | First character created |
| `FIRST_DESCENT` | `ACH_FIRST_DESCENT` | `dungeon_clears >= 1` |
| `DUNGEON_MASTER` | `ACH_DUNGEON_MASTER` | `dungeon_clears >= 10` |
| `ABYSS_WALKER` | `ACH_ABYSS_WALKER` | `dungeon_clears >= 50` |
| `PROVING_GROUNDS` | `ACH_PROVING_GROUNDS` | `ladder_wins >= 1` |
| `UNDEFEATED` | `ACH_UNDEFEATED` | `ladder_best >= 3` |
| `CHAMPION` | `ACH_CHAMPION` | `ladder_wins >= 25` |
| `LEGEND` | `ACH_LEGEND` | `ladder_wins >= 100` |
| `GODLY_STREAK` | `ACH_GODLY_STREAK` | `ladder_best >= 10` |
| `ARENA_DEBUT` | `ACH_ARENA_DEBUT` | Arena tutorial done |
| `RISING_STAR` | `ACH_RISING_STAR` | `arena_rating >= 1200` |
| `CHAMPION_TIER` | `ACH_CHAMPION_TIER` | `arena_rating >= 1500` |
| `LEGENDARY_LOOT` | `ACH_LEGENDARY_LOOT` | Obtain legendary gear |
| `MYTHIC_DROP` | `ACH_MYTHIC_DROP` | Obtain mythic gear |
| `PERFECT_CRAFT` | `ACH_PERFECT_CRAFT` | Gear quality >= 95 |
| `FULLY_EQUIPPED` | `ACH_FULLY_EQUIPPED` | All 5 slots legendary+ |
| `FIRST_FOLLOWER` | `ACH_FIRST_FOLLOWER` | Obtain any follower |
| `LEGENDARY_COMPANION` | `ACH_LEGENDARY_COMPANION` | Legendary rarity follower |
| `DUST_HOARDER` | `ACH_DUST_HOARDER` | `dust >= 5000` |
| `CLUTCH_SAVE` | `ACH_CLUTCH_SAVE` | Win with < 20% HP (hidden) |
| `NO_DAMAGE` | `ACH_NO_DAMAGE` | Clear floor with 0 damage taken (hidden) |

**Usage**: `SteamManager.unlock("FIRST_DESCENT")` — checks if already achieved, sets + stores if not.

### Steam Cloud Saves

Save files to sync via Auto-Cloud (configured in Steamworks admin, no code needed):

| File | Purpose |
|---|---|
| `user://save_data.json` | All character slots, settings, progression |
| `user://save_data.sig` | HMAC-SHA256 integrity signature |

### Store Page Assets Required

| Asset | Dimensions | Status |
|---|---|---|
| Header Capsule | 920x430 | Not created |
| Small Capsule | 462x174 | Not created |
| Main Capsule | 1232x706 | Not created |
| Vertical Capsule | 748x896 | Not created |
| Library Capsule | 600x900 | Not created |
| Library Hero | 3840x1240 | Not created |
| Library Logo | 1280w, transparent PNG | Not created |
| Screenshots (min 5) | 1920x1080 | Not created |
| Trailer | 1920x1080 H.264 | Not created |

**Capsule rules**: Only game logo/title text. No review quotes, marketing copy, or award badges.

### Revenue & Pricing

- Steam takes **30%** (drops to 25% after $10M, 20% after $50M)
- Launch discount: **20%** for 7-14 days (triggers wishlist email notifications)
- 28-day cooldown between discounts (seasonal sales exempt)
- $100 Steamworks fee recouped after $1,000 revenue

### AI Content Disclosure

Must disclose all FLUX.1 Dev generated assets on Steam's Generative AI form:
- Monster sprites (19), follower sprites (19), gear icons (48), skill icons (27)
- NPC sprites (12 Dio variants), backgrounds (12), hero bases (4), logo
- Steam does not ban AI art but requires transparency

### Timeline

| Step | Duration |
|---|---|
| Register + pay $100 | 1-3 days |
| 30-day wait (first app) | 30 days |
| Store page review | 3-5 business days |
| "Coming Soon" live minimum | 14 days |
| Build review | 3-5 business days |
| **Total minimum** | ~2 months |

**Strategy**: Put up Coming Soon page ASAP to accumulate wishlists. Consider Steam Next Fest demo for visibility.
