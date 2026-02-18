# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Architecture (pixel-arena-godot/)

Godot 4.6, viewport 640×360 (3x upscale to 1920×1080). Uses autoloads for global systems: `GameState`, `Persistence`, `Network`, `SfxManager`, `ItemDatabase`, `SkillDatabase`, `FollowerDatabase`, `ThemeManager`, `TransitionManager`. Scene-per-mode structure under `scenes/`.

Data lives in JSON files (`data/classes.json`, `items.json`, `skills.json`, `followers.json`, `monsters.json`) — snake_case equivalents of the JS data modules.

Combat scripts mirror the JS structure: `combat_engine.gd` ↔ `engine.js`, `hero_factory.gd` ↔ `hero.js`, `skill_ai.gd` ↔ `buffs.js`. Constants in `combat/constants.gd`.

Scenes: `main_menu`, `character_forge`, `class_select`, `arena`, `battle`, `ladder`, `dungeon`, `dungeon_battle`, `tutorial`.

Assets include `PixelOperator8.ttf` font, tileset sprites (puny_dungeon, buch_dungeon, kenney_roguelike), battle backgrounds, and VFX sprite sheets. Unlike the web version, the Godot port uses image assets for sprites and effects.
