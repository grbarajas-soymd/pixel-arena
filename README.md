# Pixel Arena -- Gear RPG

A browser-based pixel art autobattler with dungeon roguelike, ladder gauntlet, and **async online PvP arena** modes.

## Quick Start

```bash
npm install

# Terminal 1: Vite dev server (game client)
npm run dev

# Terminal 2: Express API server (online arena)
npm run server
```

- Game runs at `http://localhost:5173`
- API server runs at `http://localhost:3001`

## Build for Production

```bash
npm run build
npm run preview
```

The `dist/` folder contains the optimized client build. The server (`server/index.js`) runs independently.

---

## Project Structure

```
pixel-arena/
  index.html                 # Main HTML (all UI structure: arena, dungeon, ladder, custom editor, battle screen)
  package.json               # Dependencies: vite (dev), express + cors (server)
  vite.config.js             # Vite configuration
  .gitignore                 # Ignores node_modules, dist, server/data/
  server/
    index.js                 # Express API server for online arena (~80 lines)
    data/                    # Auto-created at startup, gitignored
      characters.json        # Player builds + W/L records (JSON file storage)
  src/
    main.js                  # Entry point: imports all modules, character select/create flow, initializes canvas, sets up window exports
    styles.css               # All CSS
    gameState.js             # Central mutable state singleton (zero imports, breaks circular deps)
    persistence.js           # localStorage save/load with multi-character slots and version migration
    network.js               # Thin fetch() wrapper for all API endpoints
    constants.js             # Tick rate, arena dimensions, melee range
    sfx.js                   # Web Audio procedural sound synthesis
    biomes.js                # Arena biome system (6 environments)
    custom.js                # Character forge editor (equip gear, pick skills, choose sprite)
    combat/
      engine.js              # Core combat loop: tick(), AI decision-making, attack/spell resolution, damage calc
      hero.js                # Hero factory: mkHero, mkCustomHero, mkLadderHero, mkArenaFollower, serializeBuild
    data/
      classes.js             # 4 NPC classes: Wizard, Ranger, Assassin, Barbarian (stats + spell configs)
      items.js               # All gear items by slot (weapon/helmet/chest/boots/accessory), starter loadouts
      skills.js              # ALL_SKILLS (active abilities) + ALL_ULTS (ultimate abilities)
      followers.js           # Follower templates, rarity tiers, combat stats, buff/debuff definitions
    modes/
      arena.js               # Arena mode: online opponent browsing, registration, build upload, battle launch, win/loss handling
      dungeon.js             # Dungeon roguelike: 8 floors x 3 rooms, room generation, gear/follower drops, merchants
      dgCombat.js            # Dungeon turn-based combat: JRPG speed timeline, monster AI, companion system
      ladder.js              # Ladder gauntlet: fight 4 classes then infinite procedural challengers, follower rewards
    tooltip.js               # Universal tooltip system (hover on desktop, long-press on mobile)
    render/
      arena.js               # Canvas rendering: sprites, ground tiles, particles, projectiles, damage numbers
      sprites.js             # Procedural pixel-art sprite generation for all character classes
      charSheet.js           # Character sheet component (stats, equipment, skills display)
      ui.js                  # HUD bars, buff/debuff display, follower cards, stake UI, defeat sheet helper
```

---

## Game Modes

### Arena (Online PvP)
Players register with a display name, upload their character build to the server, and browse other players' builds. Selecting an opponent starts a client-side autobattle where AI controls the opponent's uploaded build. Win/loss records are tracked per player on the server.

**Flow:** Register -> Upload Build -> Browse Opponents -> Select + Wager Follower -> Battle -> Result reported to server

### Dungeon (Roguelike PvE)
8-floor dungeon crawl with 3 rooms per floor. Room types: combat, treasure, trap, rest, shrine, merchant, follower cage. Turn-based JRPG-style combat with speed-based turn timeline, skills, potions, and auto-battle. Gear drops persist permanently. Followers are captured and added to your collection. Players can bring an existing follower as a combat companion before descending.

### Ladder (Gauntlet PvE)
Fight the 4 NPC classes in sequence, then face infinite procedurally-generated challengers with random gear and skills that scale with wins. Earn a follower every 3 wins.

---

## Online Arena System (Detailed)

### Architecture

The online arena uses a **client-authoritative async PvP** model:
- Players upload their character build (stats, gear, skills) to a local Express server
- Other players browse uploaded builds and challenge them
- Battles run entirely client-side -- the opponent's build is loaded into the existing `mkLadderHero()` factory
- After the battle, the result (win/loss) is reported back to the server
- No real-time networking, no sockets -- purely REST API + JSON storage

### Identity System

- **Simple name-based identity** -- player picks a display name, server generates a UUID
- `playerId` and `playerName` are stored in `state` and persisted in localStorage
- No passwords, no authentication beyond the UUID in the `X-Player-Id` header
- Identity survives page reloads (loaded from localStorage on startup)

### Server API

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/register` | Body: `{ name }`. Returns `{ playerId }` (UUID) |
| `PUT` | `/api/characters` | Header: `X-Player-Id`. Body: serialized build. Updates player's hosted build |
| `GET` | `/api/characters` | Query: `?exclude=<playerId>`. Returns array of all other players' builds + records |
| `GET` | `/api/characters/:playerId` | Returns one player's build |
| `POST` | `/api/battles` | Body: `{ challengerId, defenderId, challengerWon }`. Updates both players' W/L records |

Storage: flat JSON file at `server/data/characters.json`. Auto-created on server startup.

### Build Serialization

`serializeBuild()` in `src/combat/hero.js` packages the current custom character for upload:

```javascript
{
  name: "MyHero",
  sprite: "wizard",
  equipment: { weapon: "great_sword", helmet: "dragon_helm", ... },
  skills: [0, 2],          // indices into ALL_SKILLS
  ultimate: 0,             // index into ALL_ULTS
  rangeType: "melee",      // from getWeaponRangeType()
  stats: {                 // from getCustomTotalStats() -- pre-computed final values
    hp, baseDmg, baseAS, def, evasion, moveSpeed,
    mana, manaRegen, energy, energyRegen, spellDmgBonus
  }
}
```

The `stats` object contains **final computed values** (base stats + all gear bonuses). This is what `mkLadderHero()` consumes directly -- it doesn't need to re-derive stats from equipment.

### Client Network Layer (`src/network.js`)

Thin async `fetch()` wrappers. All functions return Promises. Errors are caught in the calling code (arena.js) and shown as status messages -- network failures never crash the game.

### Battle Flow

1. `launchBattle()` checks: must have selected opponent + wagered follower (if you have any)
2. Opponent's build is unpacked from `state.onlineOpponents` into `state._ladderGenConfig` (flat object with `hp`, `baseDmg`, etc.)
3. `state.p2Class` is set to `'custom'` so `mkHero()` routes to `mkLadderHero()`
4. `startBattle()` creates both heroes, applies wager follower buff/debuff, starts the combat tick loop
5. `showWin()` fires when combat ends:
   - If player lost: wagered follower is removed from `state.p1Collection`
   - If online opponent: `network.reportBattle()` updates both players' records on the server
   - Defeat sheet shows the opponent's stats/skills
   - `saveGame()` is called immediately to persist follower loss
   - `state.selectedOpponent` and `state._ladderGenConfig` are cleared

### Follower System (Arena)

**Simplified from the old 3-fighter + 1-wager system to just 1 required wager:**
- Select exactly 1 follower to wager before battle
- The wagered follower's buff applies to your hero, its debuff applies to the enemy
- Lose the battle = lose the follower permanently
- No fighter followers spawn as AI combatants in arena mode (ladder still has fighters)

### Defeat Sheet

`buildDefeatSheet(data)` in `src/render/ui.js` is a reusable helper that renders a compact stat card showing what killed you. Used in all three modes:
- **Arena**: shows opponent hero stats + skills on loss
- **Dungeon**: shows monster HP/DMG/DEF in the death screen
- **Ladder**: shows class stats or generated opponent build details on loss

---

## State Management

All mutable game state lives in `src/gameState.js` as a single exported `state` object. This file has **zero imports** to break circular dependency chains. Every other module imports `state` from here.

Key state fields:
- `state._activeSlotIndex` -- index of the currently loaded character slot (null if none loaded)
- `state.playerId` -- UUID from server registration (per-character)
- `state.playerName` -- display name (per-character)
- `state.onlineOpponents` -- fetched opponent list (array of `{ playerId, playerName, character, record }`)
- `state.selectedOpponent` -- currently selected opponent's playerId
- `state._ladderGenConfig` -- flat config object used by `mkLadderHero()` (shared with ladder mode)

### Persistence (Multi-Character)

The game uses a **v3 multi-slot save format** stored in a single `localStorage` key (`pixel-arena-save`). Up to 4 character slots are supported, each with independent gear, followers, ladder records, and online identity.

```javascript
// v3 save wrapper
{
  version: 3,
  activeSlot: 0,                    // last-played character index
  preferences: { spd: 2 },          // shared across all characters
  slots: [
    {
      id: "char_1707000000000",
      name: "Warrior",
      sprite: "barbarian",
      customChar: { name, equipment, skills, ultimate, sprite },
      p1Collection: [],              // follower collection
      gearBag: [],                   // unequipped gear
      ladderBest: 0,
      playerId: null,                // online arena identity
      playerName: null,
      savedAt: "2025-02-15T...",
      createdAt: "2025-02-15T...",
    },
    // ... up to 3 more
  ]
}
```

**Migration chain:** v1 -> v2 -> v3 runs automatically. Existing single-character saves become `slots[0]`.

**Key functions:**
- `saveGame()` — writes active character's state to its slot in the wrapper
- `loadSaveWrapper()` — loads and migrates the wrapper, returns it (does not populate state)
- `loadCharacterSlot(idx)` — populates `state` from a specific slot
- `createCharacterSlot(name, archetype)` — creates a new slot from `STARTER_LOADOUTS`
- `deleteCharacterSlot(idx)` — removes a slot

Auto-save fires on `beforeunload`. A "Saved" toast notification appears on key save events (character creation, etc.). Follower ability functions are rehydrated from templates since functions can't be serialized to JSON.

---

## Key Integration Points

### How online builds become battle opponents

```
serializeBuild() --> network.uploadBuild() --> server stores in characters.json
                                                      |
network.fetchOpponents() <----------------------------+
      |
state.onlineOpponents = [{ playerId, character, record }, ...]
      |
launchBattle() --> unpack character.stats into state._ladderGenConfig
      |
mkHero('custom', 'right') --> detects state._ladderGenConfig --> mkLadderHero(cfg)
      |
Normal combat tick loop runs with both heroes
```

### How `mkLadderHero` works

`mkLadderHero(cfg, side)` creates a hero object from a flat config. It's used by both the ladder system (for procedurally generated opponents) and the online arena (for uploaded player builds). The config needs: `name`, `sprite`, `hp`, `baseDmg`, `baseAS`, `def`, `evasion`, `moveSpeed`, `skills` (array of skill indices), `ultimate` (ult index), `rangeType` ("melee" or "ranged").

### Window exports

HTML uses `onclick=""` handlers, so all interactive functions are exposed via `window.functionName` in `main.js`. New exports for online arena: `registerPlayer`, `uploadBuild`, `refreshOpponents`.

---

## Development Notes

- **No frameworks** -- Pure vanilla JS + Canvas. No React, no state management libraries.
- **Vite** handles bundling/HMR for the client. Server code is not bundled by Vite.
- The two Vite warnings about dynamic imports (dungeon.js, ladder.js) are expected -- `arena.js` uses dynamic `import()` for lazy loading these modules on mode switch, but `main.js` also statically imports them. This is harmless.
- All combat math (damage, defense mitigation, evasion, attack speed) is in `src/combat/engine.js`.
- Sprite rendering is in `src/render/arena.js` -- procedural pixel art, no image assets.
