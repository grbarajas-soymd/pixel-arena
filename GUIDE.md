# Pixel Arena — New Player Guide

## Getting Started

When you first load the game, you'll see a **start screen** with the Pixel Arena logo. Tap **ENTER THE ARENA** to begin. You can check "Don't show again" to skip it on future visits.

On your first visit, you'll choose an **archetype** that determines your starting gear and skills. You can change everything later in the Character Forge.

| Archetype | Weapon | Skills | Ultimate | Playstyle |
|-----------|--------|--------|----------|-----------|
| **Warrior** | Rusty Blade (melee) | Charge, War Cry | Berserker Rage | Tanky brawler, free skills |
| **Archer** | Wooden Bow (ranged) | Hunter's Mark, Bloodlust | Rain of Fire | Bleed-stacking DPS |
| **Rogue** | Rusty Daggers (hybrid) | Shadow Step, Envenom | Death Mark | Fast burst + poison |
| **Mage** | Worn Wand (ranged) | Chain Lightning, Static Shield | Thunderstorm | Burst damage + shields |

**Warrior** is recommended for new players — both skills cost zero resource, so you never run dry.

The game works on both **desktop and mobile**. Tablets in landscape use the desktop layout; portrait orientation switches to a mobile-friendly single-column layout. The app auto-detects your device and adjusts.

---

## Core Stats

| Stat | What It Does |
|------|-------------|
| **HP** | Health pool. Die at 0. |
| **DMG** | Base damage per hit. |
| **AS (Attack Speed)** | Determines turn order in combat. Higher = more turns. |
| **DEF** | Reduces incoming damage. Formula: `1 - min(DEF/300, 0.8)` — caps at 80% reduction. |
| **EVA (Evasion)** | Chance to completely dodge an attack. |
| **Mana / Energy** | Resource pool for casting skills. |
| **Move Speed** | How fast you move on the arena battlefield. |
| **Spell Dmg %** | Bonus multiplier on spell/skill damage. |

Your total stats come from **base stats + equipment + follower buffs**. Base stats are fixed (3500 HP, 60 dmg, 0.5 AS, 15 DEF). Gear and followers are where all your power comes from.

---

## Game Modes

### Dungeon (Start Here)

The dungeon is your primary progression loop. You descend through floors of randomized rooms, fighting monsters, collecting gear, and capturing followers.

**How it works:**
- Each floor has 3 rooms. Rooms 1-2 are random events. Room 3 is always a **boss fight**.
- You enter at **85% HP** with **3 potions** (each heals 35% of max HP).
- Between floors, your hero heals 30%.
- The dungeon has **8 floors**. Clearing all 8 completes the run.

**Room types:**

| Room | Icon | Description |
|------|------|-------------|
| **Combat** | ⚔ | Fight a monster. Turn-based with skills, potions, and auto-battle. |
| **Treasure** | 💰 | Gold + chance for a run item (temporary buff) + chance for gear drop. |
| **Trap** | ⚠ | Take damage. You can Endure (full damage, reduced by DEF) or Dodge (evasion-based chance to avoid all, fail = half damage). |
| **Rest** | 🏕 | Heal 25% of max HP. |
| **Shrine** | ⛩ | Sacrifice HP for a permanent run buff (+DMG, +HP, +DEF, +EVA, +AS, +Lifesteal, +Crit, +Spell Power). |
| **Merchant** | 🏪 | Buy consumables and gear with gold. Appears from floor 3 onward. |
| **Follower Cage** | 👾 | Capture a follower to use in Arena and Ladder. |

**Tips:**
- Room types never repeat back-to-back, so you won't get trap-trap or combat-combat in a row.
- Boss fights (room 3) always drop gear. Regular combat has a 15% gear drop chance.
- Shrines are high-value — the stat buffs last the entire run and stack.
- Save potions for floor 3+ boss fights where damage spikes hard.

#### Dungeon Combat — Turn Timeline

Dungeon combat uses a **JRPG-style speed-based turn system**. Instead of rigid hero→monster alternation, turns are determined by each combatant's **speed** (based on Attack Speed stat).

**How the timeline works:**
- Each combatant accumulates **Action Points (AP)** each tick based on their speed.
- When a combatant reaches 100 AP, they take their turn. Leftover AP carries over.
- A **timeline bar** at the top of the combat screen shows the next 8 upcoming turns.
- Faster heroes get **more turns** than slower monsters — investing in Attack Speed is rewarded.

**Turn order display:**
- **YOU** (blue) = your hero's turn
- **Monster name** (red) = the monster's turn
- **Companion icon** (purple) = your companion follower's turn

**Each turn, pick an action:** Basic Attack, Skill 1, Skill 2, Ultimate, Potion, or trigger your Companion's ability.

**Auto-battle** lets the AI fight for you. It prioritizes efficiently — skipping buff skills against weak enemies and reacting to monster telegraphs (see Monster Specials below).

#### Monster Specials & Telegraphs

Monsters have **special abilities** that they telegraph before using:

| Special | Telegraph | Effect | Counter |
|---------|-----------|--------|---------|
| **Heavy Strike** | "winds up a heavy blow!" | 2x damage attack | Use shield or dodge |
| **Enrage** | "roars with fury!" | +50% damage for 2 rounds | Burst them down or shield up |
| **Poison Spit** | "gathers venom!" | 3 rounds of poison on you | Use potion after |
| **Heal** | "begins to regenerate!" | Heals 20% of its max HP | Burst damage to offset |
| **War Stomp** | "stomps the ground!" | Stuns you for 1 turn | High evasion can dodge it |

**Key mechanic:** When a monster telegraphs a special, it still basic-attacks that turn. The special fires on its **next** turn. If you **stun the monster while it's charging**, the special is **cancelled**! This rewards saving stun skills for the right moment.

#### Deployed Companion

When you capture a follower during a dungeon run, it provides two benefits:

1. **Passive stat buffs** — immediately applied to your hero for the rest of the run (bonus DMG, DEF, HP, etc. based on the follower's combat stats).
2. **Active combat companion** — your first captured follower is automatically **deployed** as a combat companion. It appears on the turn timeline and:
   - Auto-attacks the monster on its turns
   - Has a special ability you can trigger during your own turn (heal, stun, shield, big damage)
   - Takes 30% splash damage from monster attacks
   - Has its own HP bar shown below your hero

If you capture multiple followers, you can switch which one is deployed using the **Deploy** button in the sidebar.

**What you keep:**
- **Gear** persists forever. Equipped items and stashed items in your Gear Bag carry between runs.
- **Followers** captured during the run are kept (all on victory, half on death).
- **Run items** (Whetstone, Swift Elixir, etc.) and **gold** are lost when the run ends.

---

### Ladder

The ladder is a gauntlet of fights testing your gear and skill build. You fight a fixed bracket of 4 class opponents, then face infinite randomly generated challengers.

**Bracket order:**
1. Iron Mage (Wizard)
2. Flame Archer (Ranger)
3. Frost Blade (Rogue)
4. Blood Warlord (Warrior) — the hardest of the four

After beating all 4, you face procedurally generated **Challengers** that scale with your win count.

**Followers in Ladder:**
- Assign up to **3 fighters** — they battle alongside you in real-time.
- Optionally **wager** 1 follower — its buff applies to you and its wager debuff hits the opponent. If you lose, you lose that follower.

**Rewards:**
- Every **3 wins** earns a follower (guaranteed rare or better quality).
- Your best win streak is tracked.

**Tips:**
- Do at least one dungeon run for gear before attempting the ladder.
- The Wizard (fight 1) is the easiest — test your build there.
- The Warrior (fight 4) is the gatekeeper. If you can't beat him, you need better gear.
- Wager followers with strong debuffs (like Chaos Dragon's -500 HP, -30 DEF, -20% AS) for tough fights.
- Fighter followers deal real damage — bring your strongest ones.

---

### Arena (Online PvP)

Fight other players' heroes online and wager followers.

- Your hero fights against uploaded opponent heroes.
- You must wager a follower to fight.
- Win = keep your follower + earn rewards. Lose = lose your wagered follower.

---

## Equipment

Gear comes in 6 rarities:

| Rarity | Color | Source |
|--------|-------|--------|
| **Starter** | Gray | Starting equipment only |
| **Common** | White | Dungeon floors 1-2 |
| **Uncommon** | Green | Dungeon floors 1-4 |
| **Rare** | Blue | Dungeon floors 3+ |
| **Epic** | Purple | Dungeon floors 5+ |
| **Legendary** | Orange | Dungeon floors 5+ (very rare) |

**Equipment slots:** Weapon, Helmet, Chest, Boots, Accessory

**Notable gear:**

| Item | Rarity | Slot | Stats | Notes |
|------|--------|------|-------|-------|
| Arcane Staff | Common | Weapon | +55 Dmg, 0.55 AS, +8% Spell | Good mage upgrade |
| Chain Mail | Common | Chest | +22 DEF, +300 HP | Big survivability boost |
| Swift Shortbow | Uncommon | Weapon | +60 Dmg, 0.8 AS | Fast ranged DPS |
| Frost Daggers | Rare | Weapon | +100 Dmg, 0.85 AS | Strong melee weapon |
| Plate Armor | Rare | Chest | +30 DEF, +500 HP, -10 Spd | Tank chest piece |
| Flame Longbow | Epic | Weapon | +170 Dmg, 0.85 AS | Massive ranged DPS |
| Greatsword | Legendary | Weapon | +250 Dmg, 0.85 AS | Best melee weapon |
| Dragonscale | Legendary | Chest | +40 DEF, +1000 HP, -5 Spd | Best tank chest |
| Stormstriders | Legendary | Boots | +65 Spd, +8% Eva, +0.1 AS | Best boots |

**Tip:** Hover over any gear item (or long-press on mobile) to see a detailed tooltip with full stats and a comparison vs your currently equipped item in that slot. Green numbers mean the new item is better, red means worse. This works everywhere — equipment slots, gear bag, dungeon merchant, and loot drops.

---

## Skills

You pick **2 skills** and **1 ultimate** in the Character Forge.

### Active Skills

| Skill | Source | Cost | Cooldown | Effect |
|-------|--------|------|----------|--------|
| **Chain Lightning** | Mage | 35 mana | 5s | 260 dmg + stun + slow |
| **Lightning Bolt** | Mage | 20 mana | 2.5s | 140 dmg (fast, spammable) |
| **Static Shield** | Mage | 45 mana | 10s | 420 HP shield for 2 rounds |
| **Hunter's Mark** | Archer | 15 res | 8s | Slow enemy + guarantee next hit |
| **Bloodlust** | Archer | 25 res | 12s | Attack speed boost + healing |
| **Summon Pet** | Archer | 30 res | 15s | Summon a fire pet to fight |
| **Shadow Step** | Rogue | 25 res | 3.5s | Teleport behind enemy + stealth (1 round) |
| **Envenom** | Rogue | 25 res | 8s | Poison your attacks for 2 rounds |
| **Smoke Bomb** | Rogue | 35 res | 12s | +45% evasion for 1 round |
| **Charge** | Warrior | Free | 5.5s | Dash to enemy + 200 dmg |
| **War Cry** | Warrior | Free | 10s | Slow enemy 25% for 1 round |

*Note: In dungeon combat, buff/debuff durations are measured in "rounds" (1 round = until the monster acts again), not seconds. A fast hero gets more attacks within each round.*

### Ultimates

Ultimates trigger automatically when your HP drops below a threshold. They can only be used once per fight.

| Ultimate | Source | Threshold | Effect |
|----------|--------|-----------|--------|
| **Thunderstorm** | Mage | 25% HP | 4 lightning strikes (150 dmg each) + 35% lifesteal per hit |
| **Rain of Fire** | Archer | 20% HP | 1 round invulnerability + 1 extra attack + fire damage |
| **Death Mark** | Rogue | 20% HP | Marks enemy — stores 75% of damage dealt for 2 rounds, then detonates |
| **Berserker Rage** | Warrior | 30% HP | +35% damage for 2 rounds |

**Build tips:**
- **Warrior builds**: Charge + War Cry is the most forgiving combo (both free). Berserker ult triggers at a generous 30% HP.
- **Mage builds**: Need mana gear (Worn Wand, Arcane Staff, Mana Crystal). Chain Lightning + Static Shield gives burst + survival.
- **Rogue builds**: Shadow Step + Envenom for burst poison damage. Death Mark rewards getting lots of hits in.
- **Hybrid builds**: Mix skills from different classes. Charge (Warrior, free) pairs well with anything.

---

## Followers

Followers are creatures you capture in the dungeon or earn from the ladder. They serve multiple purposes:

**1. Dungeon Companion** (deployed during runs)
- Your first captured follower is auto-deployed as a **combat companion**.
- They fight alongside you on the turn timeline, auto-attacking and using abilities.
- They also grant **passive stat buffs** to your hero for the rest of the run.
- You can switch which follower is deployed using the Deploy button.

**2. Arena/Ladder Fighters** (up to 3)
- They physically fight alongside you in real-time battles.
- Each has HP, DMG, AS, DEF, and a special ability on cooldown.
- They die permanently in that fight if killed (they come back next fight).

**3. Wager Buff/Debuff** (1 per fight)
- Your wagered follower's **buff** applies to you (e.g., +40 Dmg, +300 HP).
- Its **wager debuff** applies to the enemy (e.g., -12 DEF, -15% AtkSpd).
- **Risk:** If you lose the fight, you lose that follower permanently.

### Follower Tier List

| Follower | Rarity | Fighter Role | Wager Debuff |
|----------|--------|-------------|--------------|
| Fire Imp | Common | Fast DPS, Scorch (-8 DEF) | -12 DEF |
| Stone Golem | Common | Tank, Fortify (+15 DEF) | -15% AtkSpd |
| Frost Wolf | Uncommon | DPS, Frostbite (25% slow) | Start 15% slowed |
| Thunder Hawk | Uncommon | Ranged DPS, Dive Bomb (120 dmg + stun) | -5% Evasion |
| Flame Drake | Rare | AoE fire breath (150 dmg to all) | -20 DEF, -15% AS |
| Shadow Panther | Rare | Burst DPS, Ambush (200 crit) | -8% Eva, -20 Spd |
| Phoenix | Epic | Revives once at 50% HP | -400 HP, -20 DMG |
| Ancient Treant | Epic | Ultra-tank, heals owner 300 HP | -30% MoveSpd |
| Chaos Dragon | Legendary | 250 AoE + stun + burn | -500 HP, -30 DEF, -20% AS |
| Death Knight | Legendary | 200 dmg + heals self and owner 150 | -400 HP, -25 DMG, -15 DEF |

---

## Dungeon Monsters

Each monster has unique pixel-art sprites, stats, and special abilities:

| Monster | Floors | Specials | Notes |
|---------|--------|----------|-------|
| Goblin Scout | 1-2 | Heavy Strike | Weak but can surprise with big hits |
| Cave Bat | 1-2 | Enrage | Gets dangerous if fight drags on |
| Slime | 1-3 | Heal | Annoying sustain, burst it down |
| Skeleton Warrior | 2-4 | Heavy Strike | Solid damage dealer |
| Orc Warrior | 3-5 | Heavy Strike, Enrage | Double threat — stun the enrage |
| Dark Mage | 3-5 | Heal, War Stomp | Can stun you + heal itself |
| Troll | 4-6 | Heal, Enrage | Tough combo, prioritize burst |
| Ghost | 4-6 | Poison Spit | Floats through attacks, poisons you |
| Minotaur | 5-7 | Heavy Strike, War Stomp | Boss-tier, stun the heavy strike |
| Lich | 5-7 | Poison Spit, Heal | Sustained threat, bring burst |
| Stone Golem | 5-7 | War Stomp, Enrage | Tanky stunner |
| Wyvern | 6-8 | Enrage, Poison Spit | Winged menace |
| Dragon | 6-8 | Enrage, Heavy Strike | Late-game powerhouse |
| Demon Lord | 7-8 | War Stomp, Poison Spit | Floor 7-8 boss, very dangerous |
| Ancient Wyrm | 8 | Heal, Enrage | Final boss, massive stats |

---

## Progression Path

Here's the recommended path for a new player:

1. **Pick Warrior archetype** — free skills, tanky, forgiving.
2. **Run Dungeon** — aim to clear floors 1-3 on your first run. Floors 1-2 are easy, floor 3 is where it gets real.
3. **Equip upgrades** — any Common or Uncommon drop is a huge upgrade over starter gear.
4. **Capture followers** — your first captured follower becomes a combat companion, boosting your stats and fighting alongside you.
5. **Run Dungeon again** — with better gear and a companion, push for floor 4+.
6. **Try Ladder** — after 1-2 dungeon runs, you should have enough stats to beat the first 2-3 ladder opponents.
7. **Grind for rares** — Rare+ gear from floor 3+ dungeons and ladder follower rewards will power you up significantly.
8. **Push deeper** — Epic/Legendary gear from floors 5+ lets you clear the full dungeon and go deep in the ladder.

### Power Benchmarks

| Milestone | Approximate Stats | What You Can Do |
|-----------|------------------|-----------------|
| Fresh start | 3800 HP, 120 dmg, 30 DEF | Dungeon floors 1-2 easy |
| After 1 dungeon | ~4200 HP, 150 dmg, 45 DEF | Dungeon floor 3, Ladder fights 1-2 |
| After 2-3 dungeons | ~5000 HP, 200 dmg, 55 DEF | Dungeon floor 4-5, Ladder fights 3-4 |
| Mid-game gear | ~6000 HP, 250+ dmg, 65+ DEF | Full dungeon clear, deep ladder |
| Endgame | ~7000+ HP, 300+ dmg, 80+ DEF | Speed-running dungeons, 10+ ladder wins |

---

## Character Forge

Access the Character Forge by clicking **Edit Hero** from any mode's hero card.

Here you can:
- **Swap equipment** between equipped slots and your Gear Bag
- **Pick 2 skills** from all 11 available skills
- **Pick 1 ultimate** from all 4 ultimates
- **Choose your sprite** (Mage, Archer, Rogue, Warrior appearance)
- **Name your hero**

Your stat totals update live as you change gear. The preview canvas shows your hero sprite.

**Tooltips:** Hover over any equipment slot, skill, or follower card to see detailed stats. On mobile, long-press (~0.4s) to show the tooltip, then release to dismiss it.

---

## Controls

| Button | What It Does |
|--------|-------------|
| **Mode tabs** (Arena / Dungeon / Ladder) | Switch between game modes |
| **Edit Hero** | Open the Character Forge |
| **RESET** | Wipe all progress (gear, followers, stats) and start fresh |
| **Auto-battle** (in dungeon combat) | Let the AI fight for you. Resets each fight. |
| **Speed buttons** (1x/2x/5x/10x) | Control arena/ladder battle speed |
| **Biome button** | Change the battle arena appearance |
| **Sound button** | Toggle sound effects |
| **Deploy** (dungeon sidebar) | Switch which captured follower is your active combat companion |
| **Hover / Long-press** | Show detailed tooltip on gear, skills, followers, and items |

---

## FAQ

**Q: I keep dying on floor 3. What do I do?**
Save potions for the boss. Use shrines when you find them — the permanent stat buffs add up fast. Rest rooms are free healing. Capture a follower early — their passive buffs and combat companion help significantly. Watch for monster telegraphs and save stun skills to cancel dangerous specials.

**Q: Should I equip or stash gear drops?**
Hover (or long-press on mobile) the gear to see a full stat comparison vs your equipped item — green stats are upgrades, red are downgrades. If the new item is better in your key stats (DMG for damage dealers, HP/DEF for survival), equip it. Stash is useful if you want to keep your current item and try the new one later. You can also hover gear in the merchant shop and your gear bag to compare before making decisions.

**Q: Which skills should I pick?**
For beginners: **Charge + War Cry** (both free, no resource management). For more damage: **Chain Lightning + Charge** (burst + gap close). For survival: **Static Shield + any damage skill**. For burst: **Shadow Step + Envenom** (rogue combo).

**Q: How does the turn timeline work?**
Each combatant has a speed stat. Every tick, everyone gains AP equal to their speed. First to reach 100 AP acts. Faster characters get more turns. The timeline bar at the top shows the next 8 turns so you can plan ahead.

**Q: How do monster telegraphs work?**
When a monster telegraphs (e.g., "winds up a heavy blow!"), the special fires on its NEXT turn. If you stun the monster before it acts again, the special is cancelled! This is the key strategic decision in dungeon combat.

**Q: How do followers work as companions in dungeons?**
Your first captured follower is auto-deployed as a combat companion. They appear on the turn timeline, auto-attack monsters, and have a special ability you can trigger during your turn. They also give passive stat buffs to your hero.

**Q: How do followers work as fighters in arena/ladder?**
You assign up to 3 followers as fighters. They spawn on the battlefield and fight autonomously with their own HP, attacks, and abilities. They're like mini-allies.

**Q: What's the wager system?**
You bet 1 follower per fight. Its buff stats apply to you, and its wager debuff hits the enemy. Great risk/reward — powerful followers have devastating wager debuffs but you lose them if you lose.

**Q: Can I change my archetype later?**
Yes. Open the Character Forge and click "Change Class" at the bottom. This changes your sprite but keeps all your gear. You can also manually swap skills and equipment to build any hybrid you want.

**Q: Does the game work on mobile?**
Yes! The game auto-detects your device. Phones use a mobile-friendly single-column layout. Tablets switch between desktop (landscape) and mobile (portrait) layouts automatically. All touch targets are sized for easy tapping.
