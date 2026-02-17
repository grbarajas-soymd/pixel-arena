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

- **`src/main.js`** — Entry point. Imports all modules, runs character select/create flow, exports interactive functions to `window.*` (HTML uses `onclick=""` handlers).
- **`src/persistence.js`** — localStorage save/load with v4 multi-character slot format. Handles v1→v2→v3→v4 migration automatically. Auto-saves on `beforeunload`.
- **`src/network.js`** — Thin `fetch()` wrappers for all server API calls. Errors are caught by callers and shown as status messages (never crash).
- **`src/combat/engine.js`** — Core tick-based combat loop (~17ms ticks). Contains all combat math: damage, defense, evasion, attack speed, status effects, AI decision-making.
- **`src/combat/hero.js`** — Hero factory functions: `mkHero`, `mkCustomHero`, `mkLadderHero`, `mkArenaFollower`. Also `serializeBuild()` for online upload.
- **`src/data/items.js`** — D4-inspired gear system with dynamic stat rolling per rarity tier. `rollGearInstance()` creates unique instances; `resolveGear()` handles both legacy string keys and new instance objects.
- **`src/data/followers.js`** — Follower templates, crafting (`craftFollower`), and upgrades (`upgradeFollower`). Follower ability functions are rehydrated from templates on load since functions can't be serialized.

### Game Modes (`src/modes/`)

- **`arena.js`** — Async online PvP. Uploads builds via REST API, battles run client-side against opponent data.
- **`dungeon.js`** — Roguelike PvE. Floors × 3 rooms with combat, treasure, traps, shrines, cages, etc.
- **`dgCombat.js`** — Turn-based JRPG-style dungeon combat with speed timeline.
- **`ladder.js`** — Gauntlet PvE. 4 NPC classes then infinite procedural challengers.

Dungeon and ladder use dynamic `import()` for lazy loading (the Vite warnings about this are expected and harmless since `main.js` also statically imports them).

### Rendering (`src/render/`)

All rendering is Canvas 2D. `render/arena.js` handles the main battle view (sprites, tiles, particles, projectiles, damage numbers). `render/sprites.js` generates procedural pixel-art characters. No image assets are used for game graphics.

### Server (`server/index.js`)

Express API server (~340 lines) for online arena. Flat JSON file storage at `server/data/characters.json` (auto-created, gitignored). REST endpoints for registration, build upload, opponent browsing, battle reporting, and leaderboard. No authentication beyond UUID in `X-Player-Id` header. Admin operations use `ADMIN_KEY` env var.

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

Single localStorage key (`pixel-arena-save`), v4 format with up to 4 character slots. Each slot has independent: equipment, followers, dust, ladder records, online identity (playerId/playerName).

## Architecture (pixel-arena-godot/)

Godot 4.6, viewport 640×360 (3x upscale to 1920×1080). Uses autoloads for global systems: `GameState`, `Persistence`, `Network`, `SfxManager`, `ItemDatabase`, `SkillDatabase`, `FollowerDatabase`, `ThemeManager`, `TransitionManager`. Scene-per-mode structure under `scenes/`.
