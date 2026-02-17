# Changelog

## Balance Pass, Bug Fixes, Reset Feature, Dungeon Turn-Based Combat

### Overview

Major balance rework of the dungeon gameplay loop, consistency fixes across skill/stat
definitions, turn-based dungeon combat system (dgCombat.js), auto-battle AI, and a
globally accessible game reset button. The goal: a fresh character should comfortably
clear dungeon floors 1-2, face a real challenge on 3-4, and be competitive in early
ladder after picking up some dungeon gear.

---

### Balance Changes

#### Base Stats (`src/gameState.js`)
The custom character base stats were far too low for the dungeon scaling curve.
A starter warrior had ~55 total damage, but floor 3 monsters had 800+ HP, making
fights take 20+ turns and dealing more damage than the hero could survive.

| Stat     | Before | After | Rationale |
|----------|--------|-------|-----------|
| HP       | 3000   | 3500  | Survive floor 3-4 encounters with potions |
| baseDmg  | 20     | 60    | Kills need to happen in reasonable turn counts |
| baseAS   | 0.3    | 0.5   | Faster attacks = more engaging combat feel |
| def      | 10     | 15    | Slight bump to reduce early chip damage |

#### Starter Gear (`src/data/items.js`)
Starter weapons were contributing too little damage. A rusty blade + base stats = 50 dmg,
which couldn't keep up with monster HP scaling.

| Item         | Before              | After               |
|--------------|---------------------|----------------------|
| Rusty Blade  | +30Dmg, 0.5AS      | +50Dmg, 0.35AS      |
| Wooden Bow   | +25Dmg, 0.7AS      | +40Dmg, 0.45AS      |
| Worn Wand    | +15Dmg, 0.4AS, 50M | +30Dmg, 0.3AS, 80M  |
| Cloth Cap    | +3DEF, +50HP       | +5DEF, +100HP       |
| Cloth Tunic  | +5DEF, +80HP       | +8DEF, +150HP       |
| Worn Sandals | +1DEF, +5Spd       | +2DEF, +8Spd        |
| Copper Ring  | +5Dmg              | +10Dmg, +50HP       |

**Resulting starter warrior totals**: 3800HP, 120dmg, 0.85AS, 30DEF
**Dungeon entry (85% HP)**: 3230HP + 3 potions (each heals 35% = ~1130HP)

#### Dungeon Monsters (`src/modes/dungeon.js`)
Tier 1-2 monsters were overtuned for the starter power level. Reductions are ~15-25%
on HP/dmg/def for early tiers, with smaller tweaks to tier 3-4.

Example: Goblin Scout 400HP/45dmg/8def -> 350HP/35dmg/5def
Example: Orc Warrior 800HP/85dmg/22def -> 700HP/65dmg/18def

#### Dungeon Run Parameters (`src/modes/dungeon.js`)
- Starting HP: 70% -> 85% of max (less punishing start)
- Starting potions: 2 -> 3 (more room for mistakes)
- Combat gold: `(3+rand*7)*floor` -> `(5+rand*10)*floor` (matched treasure rooms)
- Boss gold: additional 1.5x multiplier
- Trap defense cap: 50% -> 70% (DEF was disproportionately weak vs traps)

#### Dungeon Mana Initialization (`src/modes/dungeon.js`)
Previously hardcoded `maxMana=100` and `manaRegen=8`, ignoring gear. Mage builds with
mana-granting equipment (Worn Wand +80 mana, Arcane Robe +150 mana) got no benefit.
Now uses: `Math.max(100, cs.mana)` and `Math.max(4, cs.manaRegen)`.

---

### Consistency Fixes

#### Duplicate Monster Definitions (`src/constants.js`)
`DG_MONSTERS` was defined in both `constants.js` and `dungeon.js`. The constants.js
version was exported but never imported anywhere. Removed from constants.js; the
authoritative copy lives in `dungeon.js`.

#### Skill Cost Mismatches (`src/data/classes.js`, `src/data/skills.js`)
`skills.js` is the file that actually executes skill logic. `classes.js` defines
class-specific values used by `mkHero()` for fixed-class heroes (not custom).
The values disagreed:

| Value             | skills.js (executes) | classes.js (was) | classes.js (now) |
|-------------------|----------------------|------------------|------------------|
| Chain Lightning   | cost: 35             | chainCost: 40    | chainCost: 35    |
| Static Shield     | cost: 45             | shieldCost: 55   | shieldCost: 45   |

#### Shield HP Mismatch (`src/data/skills.js`, `src/modes/dgCombat.js`)
`classes.js` had `shieldHp: 420` (buffed per comment at top of file), but `skills.js`
and `dgCombat.js` both used `380`. Unified to 420 everywhere.

#### Double Resource Regeneration (`src/modes/dgCombat.js`)
Lines 635-637 regenerated both `hero.resource` and `hero.mana` independently each turn.
For heroes with both defined, this was double-dipping. Fixed: regenerate `resource`
(the unified pool), then sync `mana` from `resource` for HUD display.

---

### Bug Fixes

#### Reset Game Not Working (`src/main.js`, `src/persistence.js`)
`resetGame()` called `localStorage.removeItem()` then `location.reload()`. But the
`beforeunload` auto-save handler fired between those two operations, re-saving the
current in-memory state and undoing the reset entirely.

Fix: set `state._resetting = true` before clearing storage. The auto-save handler
checks this flag and skips saving when true.

#### Free Skills Costing 30 Resource (`src/modes/dgCombat.js`)
`handleAction()` used `var cost = sk.cost || 30` which turns `cost: 0` (free skills
like Charge and War Cry) into 30. After 3 casts the resource pool drained and skills
silently stopped working, stalling auto-battle.

Fix: `sk.cost !== undefined ? sk.cost : 30` and skip resource deduction when cost is 0.
Same bug existed in `refreshButtonStates()` for button enable/disable logic.

#### Auto-Battle Stopping Between Fights (`src/modes/dgCombat.js`)
`initDgCombat()` reset `autoBattle = false` on every new fight. Now each fight starts
with auto-battle off, requiring the player to opt in per fight (intentional design
per user request).

#### Auto-Battle Only Using Basic Attacks (`src/modes/dgCombat.js`)
The old auto-battle AI only checked a hardcoded `SKILL_DMG` array and fell through to
basic attack if no damage skill was affordable. The new AI:

1. Uses potions at <35% HP
2. Uses ultimate near its HP threshold
3. Prioritizes damage skills (sorted by damage)
4. Uses buff/utility skills contextually:
   - Shield when HP <65% and no shield active
   - Hunter's Mark always
   - Bloodlust when not already active
   - Shadow Step when not stealthed
   - Envenom when no poison active
   - Smoke Bomb when HP <55%
   - War Cry when enemy not already slowed
   - Summon Pet when no follower alive
5. Falls back to basic attack only when nothing else applies

#### SKILL_DMG Array Brittleness (`src/modes/dgCombat.js`)
Was a positional array `[260,140,0,0,0,0,0,0,0,200,0]` that silently broke if skills
were reordered. Replaced with an object map `{0:260, 1:140, 9:200}`.

---

### New Features

#### Reset Button in Nav Bar (`index.html`, `src/styles.css`)
Previously reset was only accessible from the arena selector screen. Added a persistent
"RESET" button in the mode tab bar, visible from all game modes. Styled in subdued red
to avoid accidental clicks. Calls the same `resetGame()` with confirmation dialog.

---

### New File: `src/modes/dgCombat.js`
Turn-based dungeon combat system. This is the combat bridge between the dungeon room
system and the canvas battle renderer. Key architecture:

- **Phase machine**: `pick` -> `playerAnim` -> `monsterAnim` -> `pick` (or `done`)
- **Action buttons**: Dynamically created div (`#dgTurnActions`) inserted below canvas
- **Damage formulas**: `calcDmg()` for basic attacks, `calcSkillDmg()` for skills
  - Defense: `1 - min(def/300, 0.8)` = max 80% reduction
  - Evasion: flat chance to dodge
  - Crit: from dungeon run items, 1.75x multiplier
  - Lifesteal: from dungeon run items
- **Skill effects**: Mapped by ALL_SKILLS index (0=chainLightning through 10=warCry)
- **Status system**: Tracked in `playerStatuses[]` / `monsterStatuses[]` arrays with
  turn-based duration, auto-cleanup on expiry
- **Rendering**: Own `requestAnimationFrame` loop (`dgRender`), draws biome, ground,
  heroes, floating damage numbers, status icons, turn indicator
- **State bridge**: Reads HP/mana/stats from `state.dgRun`, writes back on combat end

---

### Files Modified

| File | Changes |
|------|---------|
| `src/constants.js` | Removed unused DG_MONSTERS/DG_ROOM_TYPES exports |
| `src/data/classes.js` | Fixed chainCost (40->35), shieldCost (55->45) |
| `src/data/skills.js` | Fixed Static Shield HP (380->420) |
| `src/data/items.js` | Buffed all starter gear stats |
| `src/gameState.js` | Buffed FIXED_BASE_STATS (HP/dmg/AS/def) |
| `src/main.js` | Added `_resetting` flag for safe reset |
| `src/persistence.js` | Skip auto-save when `_resetting` is true |
| `src/modes/dungeon.js` | Monster rebalance, mana init, gold/HP/trap fixes |
| `src/modes/dgCombat.js` | NEW: turn-based combat + all fixes listed above |
| `index.html` | Reset button in mode tabs, dungeon default mode |
| `src/styles.css` | Reset tab styling |

### Expected Gameplay Curve (Warrior Archetype)

| Phase | Hero Stats | Enemy | Outcome |
|-------|-----------|-------|---------|
| Floor 1 | 3230HP, 120dmg, 30def | Goblin 350HP/35dmg | Easy win, ~3 turns |
| Floor 2 | ~3000HP + gear | Skeleton 430HP/45dmg | Comfortable |
| Floor 3 | ~2800HP + common gear | Orc 952HP/88dmg | Challenging, needs potions |
| Floor 4 Boss | ~2500HP + uncommon gear | Boss 1700HP/123dmg | Hard, needs skills + ult |
| Ladder #1 | Post-dungeon gear | Wizard 4200HP/130dmg | Competitive fight |
