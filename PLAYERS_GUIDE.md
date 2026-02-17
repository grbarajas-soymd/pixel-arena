# Pixel Arena — Player's Guide

Welcome to Pixel Arena, a pixel art autobattler with roguelike dungeon crawling, PvE ladder gauntlets, and online PvP arena. All characters and sprites are procedurally generated — no two fights look the same.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Character Classes](#character-classes)
3. [Skills & Ultimates](#skills--ultimates)
4. [Gear & Equipment](#gear--equipment)
5. [Followers & Companions](#followers--companions)
6. [Dungeon Mode](#dungeon-mode)
7. [Dungeon Combat](#dungeon-combat)
8. [Ladder Mode](#ladder-mode)
9. [Arena (Online PvP)](#arena-online-pvp)
10. [Currencies & Progression](#currencies--progression)
11. [Strategy Tips](#strategy-tips)

---

## Getting Started

Create a character by picking one of four classes, naming your hero, and choosing 2 skills + 1 ultimate. You start with starter-tier gear in all 5 equipment slots. From the Character Forge hub you can manage equipment, followers, and launch into any game mode.

You have **3 save slots** for different characters. Progress auto-saves.

---

## Character Classes

### Iron Mage (Wizard) — "Voltaris"
**Color:** Teal | **Playstyle:** Ranged spellcaster

| Stat | Value |
|------|-------|
| HP | 4,200 |
| DMG | 130 |
| Attack Speed | 0.75 |
| DEF | 45 |
| Evasion | 0% |
| Mana | 650 |
| Mana Regen | 5.5/s |
| Spell DMG Bonus | +8% |
| Cast Speed Bonus | +12% |

**Charge Mechanic:** Each attack/spell grants a charge stack (+6% spell and basic damage per stack, max 10 stacks). Stacks decay after 4 seconds of inactivity.

**Strengths:** Highest sustained spell damage, strong shields, excellent self-healing via Thunderstorm.
**Weaknesses:** Low HP, no evasion, slow base attack speed.

---

### Flame Ranger — "Pyralis"
**Color:** Orange | **Playstyle:** Ranged bleed specialist

| Stat | Value |
|------|-------|
| HP | 4,800 |
| DMG | 180 |
| Attack Speed | 0.95 |
| DEF | 58 |
| Evasion | 5% |
| Move Speed | 100 (+15%) |

**Bleed Mechanic:** Every 3rd attack applies a bleed stack (1% of target's current HP per second for 2s). Bloodlust boosts attack speed by +5% per active bleed on target.

**Strengths:** High base damage, strong sustained DPS via bleeds, good durability.
**Weaknesses:** No mana pool (cooldown-gated), bleed damage falls off on low-HP targets.

---

### Frost Blade (Assassin) — "Glacier"
**Color:** Ice Blue | **Playstyle:** Melee burst/stealth

| Stat | Value |
|------|-------|
| HP | 4,500 |
| DMG | 140 |
| Attack Speed | 1.1 |
| DEF | 42 |
| Evasion | 18% |
| Energy | 100 |
| Energy Regen | 14/s |
| Move Speed | 135 (+10%) |

**Combo Mechanic:** Melee hits build combo stacks (max 5). Each stack gives +6% attack speed.

**Stealth:** While stealthed: +30% move speed, +50% evasion, next attack deals **3x damage**. Breaks after attacking (unless Shadow Dance is active).

**Melee Bonus:** +30% damage when within melee range.

**Strengths:** Highest burst damage (stealth + melee bonus), best evasion, fastest attacks.
**Weaknesses:** Must be in melee range, relatively low HP and DEF.

---

### Blood Warlord (Barbarian) — "Gorath"
**Color:** Red | **Playstyle:** Melee tank/berserker

| Stat | Value |
|------|-------|
| HP | 5,500 |
| DMG | 210 |
| Attack Speed | 0.85 |
| DEF | 65 |
| Evasion | 0% |
| Lifesteal | 3% |
| Move Speed | 130 (+5%) |

**Rage Mechanic:** Scales with missing HP. At full missing HP: +45% damage, +35% attack speed. The lower your HP, the stronger you get.

**Passive Resistances:** 50% stun resist, 40% slow resist, 15% spell dodge (spells deal half damage if dodged).

**Strengths:** Highest HP and DEF, best base damage, free skills (no resource cost), terrifying at low HP.
**Weaknesses:** Pure melee, no evasion, slow without rage.

---

## Skills & Ultimates

You pick **2 skills** and **1 ultimate** at character creation. Any class can use any skills.

### Skills (pick 2)

**Mage Skills:**

| Skill | Cost | Turn CD | Effect |
|-------|------|---------|--------|
| Chain Lightning | 35 mana | 2T | Damage scaling with max HP + **stuns** monster |
| Lightning Bolt | 20 mana | 1T | Quick damage scaling with max HP |
| Static Shield | 45 mana | 3T | Absorb shield scaling with DEF (320 + DEF×4) |
| Frost Nova | 30 mana | 2T | Damage scaling with DEF + **slows** 2T. Freezes stunned targets |
| Arcane Drain | 25 mana | 3T | Damage + heals you (40 + spell_bonus×400 HP) |

**Ranger Skills:**

| Skill | Cost | Turn CD | Effect |
|-------|------|---------|--------|
| Hunter's Mark | 15 | 3T | -15% evasion on target + slows 2T |
| Bloodlust | 25 | 4T | Extra attack this turn + +15% lifesteal |
| Summon Pet | 30 | 5T | Pet strike dealing 50% of your base DMG |
| Rupture | 20 | 2T | Detonate all bleed stacks for burst damage |
| Marked for Death | 20 | 3T | Target takes +8-16% bonus damage for 2T (scales with AS) |

**Rogue Skills:**

| Skill | Cost | Turn CD | Effect |
|-------|------|---------|--------|
| Shadow Step | 25 | 1T | Enter stealth — next attack deals **3x damage** |
| Envenom | 25 | 3T | Apply poison stack (30% base DMG per turn, 2T) |
| Smoke Bomb | 35 | 4T | +35%+ evasion for 1 turn (scales with base evasion) |
| Lacerate | 30 | 3T | Damage scales with enemy missing HP + applies bleed 2T |
| Riposte | 25 | 3T | Counter stance — auto-strikes back when hit next turn |

**Warrior Skills:**

| Skill | Cost | Turn CD | Effect |
|-------|------|---------|--------|
| Charge | Free | 2T | Heavy damage (1.5x DMG + DEF) + **stuns** monster |
| War Cry | Free | 3T | Weakens monster's attack damage by ~15% |
| Battle Trance | Free | 3T | Convert 60% of DEF into bonus DMG for 2T (-40% DEF) |
| Thorns | Free | 4T | Reflect 15-50% of damage taken back at attackers for 2T |

### Ultimates (pick 1 — one use per combat)

| Ultimate | Source | Effect |
|----------|--------|--------|
| **Thunderstorm** | Mage | 4 lightning strikes + heals 35% of damage dealt per hit |
| **Rain of Fire** | Ranger | Invulnerable 1T + extra attacks + burns monster (base_dmg×2/turn, 3T) |
| **Death Mark** | Rogue | All damage dealt tracked for 2+ turns, then 75% detonates at once |
| **Berserker Rage** | Warrior | +25%+ damage buff for 2+ rounds (scales with DEF) |
| **Arcane Overload** | Mage | Big burst + all skills free for 2+ turns + burn DoT |
| **Primal Fury** | Ranger | Extra attack + poison on every hit for 3+ rounds |
| **Shadow Dance** | Rogue | Persistent stealth (3x damage!) for 3+ rounds |
| **Last Stand** | Warrior | Cannot die for 2+ rounds. Heals 20% max HP when it expires |

**In dungeon combat:** You activate your ultimate manually (button press).
**In real-time combat (Arena/Ladder):** Ultimates trigger automatically when HP drops below threshold (20-30% depending on ultimate).

---

## Gear & Equipment

### Equipment Slots
You have 5 gear slots: **Weapon**, **Helmet**, **Chest**, **Boots**, **Accessory**.

### Rarity Tiers

| Rarity | Color | Stat Range | Salvage Dust |
|--------|-------|------------|--------------|
| Starter | Gray | 95-100% | 0 |
| Common | Light Gray | 75-115% | 1 |
| Uncommon | Green | 80-120% | 3 |
| Rare | Blue | 85-125% | 8 |
| Epic | Purple | 88-130% | 20 |
| Legendary | Gold | 92-135% | 50 |
| Mythic | Red | 95-140% | 120 |

Each piece rolls stats within its rarity range. A **Quality Score** (0-100) shows how well it rolled:
- 95-100: PERFECT ROLL
- 80-94: Excellent
- 60-79: Good

### Notable Weapons

| Weapon | Rarity | DMG | AS | Special |
|--------|--------|-----|----|---------|
| Rusty Blade | Starter | 60 | 0.4 | — |
| Iron Sword | Common | 75 | 0.5 | — |
| Crystal Staff | Uncommon | 80 | 0.6 | +12% Spell |
| Frost Daggers | Rare | 100 | 0.85 | — |
| Flame Longbow | Epic | 170 | 0.85 | — |
| Blood War Axe | Epic | 195 | 0.7 | — |
| Greatsword | Legendary | 250 | 0.85 | — |
| Soulreaver | Mythic | 340 | 0.95 | +300 HP |
| Astral Longbow | Mythic | 280 | 1.05 | +10% Spell |

### Notable Armor

| Item | Slot | Rarity | Key Stats |
|------|------|--------|-----------|
| Shadow Hood | Helmet | Uncommon | 8 DEF, +5% Eva, +10 Spd |
| Berserker Helm | Helmet | Rare | 10 DEF, +400 HP |
| Crown of Eternity | Helmet | Mythic | 35 DEF, +700 HP, +15% Spell, +3 MP5 |
| Leather Vest | Chest | Uncommon | 15 DEF, +8% Eva, +15 Spd |
| Plate Armor | Chest | Rare | 30 DEF, +500 HP |
| Voidplate | Chest | Mythic | 55 DEF, +1400 HP, +5% Eva |
| Windwalkers | Boots | Epic | 6 DEF, +55 Spd, +6% Eva |
| Godstriders | Boots | Mythic | 15 DEF, +85 Spd, +12% Eva, +0.15 AS |

### Notable Accessories

| Item | Rarity | Stats |
|------|--------|-------|
| Shadow Cloak | Rare | +10% Eva, +5 DEF |
| Mana Crystal | Rare | +200 Mana, +3 MP5 |
| Berserker Totem | Epic | +40 DMG, +300 HP |
| Heart of Chaos | Legendary | +55 DMG, +400 HP, +0.1 AS |
| Heart of the Abyss | Mythic | +75 DMG, +600 HP, +0.15 AS, +4% Eva |

### Gear in Dungeon
When gear drops after combat, you can:
- **Equip** — Wear it, old piece goes to your stash
- **Stash** — Save for later
- **Salvage** — Convert to dust (amount depends on rarity)

Drop rarity scales with floor number and dungeon clears. Higher floors and more clears = better drops.

---

## Followers & Companions

Followers fight alongside you and give passive stat buffs. You can deploy one companion at a time.

### Acquiring Followers
- **Dungeon cages** — Found as room events
- **Combat drops** — 8% from regular fights, 25% from bosses
- **Ladder rewards** — Every 3 ladder wins
- **Crafting** — Spend dust: Common 5, Uncommon 15, Rare 40, Epic 100, Legendary 250

### Upgrading
- Cost: 30 dust per upgrade, max 3 upgrades
- Each upgrade: +15% HP, +15% DMG, +15% DEF (stacks multiplicatively — 3 upgrades = ~52% boost)

### Follower Roster

**Common Followers:**

| Follower | Passive Buff | Combat Role |
|----------|-------------|-------------|
| Fire Imp | +8 DMG | Fast attacker, reduces target DEF |
| Stone Golem | +6 DEF, +120 HP | Tanky, taunts enemies |
| Shadow Rat | +2% Eva, +10 Spd | Very fast, applies bleeds |
| Ember Sprite | +0.05 AS | Ranged, true damage ability |
| Mud Crawler | +200 HP | Tanky, self-heals |

**Uncommon Followers:**

| Follower | Passive Buff | Combat Role |
|----------|-------------|-------------|
| Frost Wolf | +15 DMG, +12 Spd | Strong attacker, slows enemies |
| Thunder Hawk | +0.08 AS, +3% Eva | Fast ranged, stun dives |
| Iron Beetle | +12 DEF, +250 HP | Very tanky, knockback |
| Venom Spider | +12 DMG, +0.06 AS | Poison specialist |
| Bone Wraith | +180 HP, +3% Eva | Life drain heals you |

**Rare Followers:**

| Follower | Passive Buff | Combat Role |
|----------|-------------|-------------|
| Flame Drake | +25 DMG, +200 HP | AoE fire breath |
| Crystal Elemental | +16 DEF, +300 HP | Grants shield to you |
| Shadow Panther | +20 DMG, +0.1 AS, +15 Spd | Stealth ambush crits |
| Storm Serpent | +22 DMG, +0.08 AS, +6 DEF | Chain shock damage |

**Epic Followers:**

| Follower | Passive Buff | Combat Role |
|----------|-------------|-------------|
| Phoenix | +30 DMG, +350 HP, +0.06 AS | Revives once at 50% HP on death |
| Void Stalker | +28 DMG, +5% Eva, +18 Spd | High burst, steals attack speed |
| Ancient Treant | +600 HP, +18 DEF | Heals you for 200 HP |

**Legendary Followers:**

| Follower | Passive Buff | Combat Role |
|----------|-------------|-------------|
| Chaos Dragon | +42 DMG, +500 HP, +0.1 AS, +10 DEF | 200 AoE + stun + burn |
| Death Knight | +38 DMG, +400 HP, +16 DEF, +3% Eva, +12 Spd | Soul reap heals both of you |

### Dungeon Companion Abilities
In turn-based dungeon combat, companions auto-attack on their turn and use abilities periodically:
- **Turtle/Golem/Crystal** types: Shield you (30% of their max HP as shield)
- **Mole/Sprite/Wisp** types: Heal you (10% of your max HP)
- **Fox/Frog/Elemental** types: Stun the monster
- **Hawk/Wolf/Panther/Raptor/Bear** types: Big damage hit (3x their DMG)

---

## Dungeon Mode

### Structure
- **8 Floors**, each with **3 Rooms** (24 total rooms)
- Room 3 of every floor is always a **Boss Combat**
- Rooms 1-2 are randomized events
- Your hero enters at **85% max HP** with 3 potions

### Room Types

**Combat** — Fight a monster. Stats scale with floor number and dungeon clears. Boss rooms have ×1.8 HP, ×1.4 DMG, ×1.3 DEF.

**Treasure** — Free gold + chance for a run item + 50% chance of gear drop.

**Trap** — Choose to Endure (take DEF-reduced damage) or Dodge (evasion + 20% success; partial dodge = half damage). Trap types: Spike, Poison Gas, Falling Rocks.

**Rest** (Floor 2+) — Heals 25% of your max HP.

**Shrine** (any floor) — Costs 15% max HP. Grants a permanent run buff:
- Power: +35 DMG
- Vitality: +500 Max HP
- Iron: +25 DEF
- Shadows: +8% Evasion
- Fury: +0.2 Attack Speed

**Merchant** (Floor 3+) — Buy items with dungeon gold:
- Health Potion: 20g
- Damage Tome: 40g (+30 DMG)
- Shield Scroll: 35g (+20 DEF)
- Healing Salve: 25g (heal 40% HP)
- Speed Scroll: 30g (+0.15 AS)
- War Crystal: 35g (+500 HP)
- Plus 2-3 random gear pieces

**Follower Cage** — Rescue a follower. Keep it (gets passive buff + joins your run) or Release for gold.

### Difficulty Scaling
Each successful dungeon clear increases difficulty:
- +15% enemy stat scaling per clear
- +1 monster tier every 2 clears (up to +2 extra tiers)

### Monsters

**Tier 1 (Early Floors):** Goblin Scout, Cave Bat, Slime, Skeleton — Low HP/DMG, one special each.

**Tier 2 (Mid Floors):** Orc Warrior, Dark Mage, Troll, Ghost (20% evasion!), Mimic — Moderate stats, two specials.

**Tier 3 (Later Floors):** Minotaur, Lich, Stone Golem (50 DEF!), Wyvern, Fungal Horror, Yeti — Tough fights, two specials each.

**Tier 4 (Final Floors/Bosses):** Dragon, Demon Lord, Ancient Wyrm (3200 HP!), Abyssal Kraken — Very dangerous, powerful specials.

### Monster Specials (telegraphed 1 turn ahead)
| Special | Warning | Effect |
|---------|---------|--------|
| Heavy Strike | "Winding up a devastating blow!" | Next attack deals 2x damage |
| Enrage | "Entering a rage!" | +50% damage for 2 rounds |
| Poison Spit | "Preparing poison attack!" | You're poisoned for 3 turns |
| Heal | "Gathering healing energy!" | Monster heals 15% max HP (diminishing) |
| War Stomp | "Preparing to stomp!" | You're stunned next turn (can be evaded) |

---

## Dungeon Combat

Dungeon fights use a **turn-based AP timeline system**.

### How Turns Work
Each combatant (you, monster, companion) has a **Speed** stat (60-200). Every tick, each combatant gains AP equal to their speed. When anyone reaches **100 AP**, they take their turn (100 AP consumed).

**Higher speed = more frequent turns.** The turn order strip at the bottom shows the next 5 upcoming turns.

### Speed Formula
- Hero: `clamp(round(attack_speed × 100), 60, 200)`
- Monster: `clamp(round((0.8 + (tier-1) × 0.15) × 100), 60, 200)`
- Companion: `clamp(round(companion_AS × 100), 60, 200)`

### Speed Display
The stat row shows `SPD:85` for each combatant. When speed is modified (e.g., Frost Slow), it shows the modifier: `SPD:62(95)` meaning effective 62, base 95.

### Frost Slow
When you slow the monster (via Hunter's Mark, Frost Nova), their effective speed drops by **35%**. This means fewer monster turns — visible in the turn order strip.

### Your Actions Each Turn
- **ATK** — Basic attack
- **Skill 1 / Skill 2** — Use equipped skill (costs mana + has turn cooldown)
- **Ultimate** — One-time powerful ability
- **Potion** — Heal 35% max HP (limited supply)
- **Flee** — 50% + evasion chance to escape
- **Auto** — Toggle auto-battle AI

### Skill Cooldowns
Skills have **both** a mana cost **and** a turn cooldown. After using a skill, it goes on cooldown for N turns (shown as "2T" on the button). You need **both** enough mana **and** cooldown = 0 to use a skill.

Mana regenerates each monster turn (mana_regen × 2).

### Damage Formula
```
damage = base_dmg × (1 - min(DEF / 300, 0.8)) × random(0.85 - 1.15)
```
- Critical hits: 5% chance, deals 1.75x damage
- Stealth bonus: 3x damage
- Vulnerability: +bonus % from Marked for Death

### Fatigue (Turn 50+)
If a fight drags past turn 50, the monster starts taking escalating percentage-based damage each turn. You can outlast anything if you survive long enough.

---

## Ladder Mode

### How It Works
Fight an infinite sequence of opponents in **real-time combat**.

- **Fights 1-4:** Fixed NPC class opponents (Wizard, Ranger, Assassin, Barbarian) at 70% of their base stats
- **Fight 5+:** Procedurally generated opponents with scaling stats, random skills, and random gear

### Scaling
Generated opponents get stronger with each win:
- HP: 3,200 + (wins-3) × 140
- DMG: 80 + (wins-3) × 6
- DEF: 20 + (wins-3) × 2
- Plus random equipment bonuses

### Rewards
- **Every 3 wins:** Earn a rare or better follower
- Best run and total wins are tracked permanently

### Tips
- Select your best companion before each fight
- The first 4 fights are warmups — save your strong companion for the scaling fights
- Opponents' random skill combos can be dangerous — watch for stun-lock builds

---

## Arena (Online PvP)

### How It Works
1. **Upload your build** — Your current stats, skills, gear, and followers are serialized and uploaded to the server
2. **Browse opponents** — See other players' builds with their stats and W/L record
3. **Select a champion follower** — Your follower fights alongside you but is **wagered**. Lose the match, lose the follower!
4. **Fight** — Real-time combat runs locally against the opponent's uploaded build
5. **Results reported** — Win/Loss recorded on both players' profiles

### Important
- Your champion follower is at risk! Don't wager followers you can't afford to lose
- Upload your build after any gear upgrades so opponents face your latest stats
- Arena followers take 30% reduced damage from heroes

---

## Currencies & Progression

### Gold
- Earned in dungeon from: combat rewards, treasure rooms, selling rescued followers
- Spent at: merchant rooms during dungeon runs
- Gold is **per-run** in dungeon (doesn't carry between runs)

### Dust
- Earned from: salvaging gear (1-120 dust by rarity), releasing followers (3-300 by rarity)
- Spent on: crafting followers (5-250 by rarity), upgrading followers (30 per upgrade)

### Potions
- Start each dungeon run with 3
- Can buy more at merchants (20g each)
- Each potion heals 35% of max HP

### Character Progression
Your character gets stronger through:
1. **Better gear** — Found in dungeon, scales with floor and clears
2. **Followers** — Passive stat buffs + combat companions
3. **Follower upgrades** — 30 dust each, up to 3 times
4. **Dungeon shrine buffs** — Permanent for that run only
5. **Skill/ultimate choice** — Optimizing your 2 skills + 1 ultimate for your playstyle

---

## Strategy Tips

### Defense Matters
Defense reduces damage by `DEF / 300` (capped at 80% at 300 DEF). At 120 DEF you block 40% of damage. The scaling is linear — every point of DEF is equally valuable.

### Speed Wins Dungeon Fights
Higher speed means more turns. A hero with 120 speed gets roughly twice as many turns as one with 60 speed. Invest in attack speed to snowball your turn advantage. The turn order strip shows you exactly how many turns you'll get before the monster acts.

### Stealth is Incredibly Powerful
Shadow Step gives 3x damage on your next attack — including skill damage. Combo with high-damage skills like Charge (1.5x DMG + DEF) for devastating burst.

Shadow Dance ultimate gives persistent stealth for 3+ rounds — every attack deals 3x damage. Pair with fast attack speed for absurd DPS.

### Bleed Stacking
Bleeds deal 30% of your base DMG per turn. Stack them with Envenom + Lacerate, then detonate with Rupture for massive burst. Best against high-HP bosses.

### Frost Slow Changes Everything
Slowing the monster cuts their speed by 35%. This directly translates to fewer monster turns. Hunter's Mark and Frost Nova both apply slow — use them to dominate the turn economy.

### Shrine Decisions
Shrines cost 15% of your max HP — steep early, cheap late. The best shrine buffs depend on your build:
- **Power (+35 DMG)** — Always good for damage builds
- **Vitality (+500 HP)** — Great survivability
- **Iron (+25 DEF)** — Strong if you're below 200 DEF
- **Shadows (+8% Eva)** — Amazing for evasion builds (capped at 50%)
- **Fury (+0.2 AS)** — More speed = more turns = more damage

### Fatigue is Your Safety Net
Can't kill a tough boss? Survive to turn 50 and the monster starts taking escalating damage. Stack potions + Last Stand + Thorns/Riposte to outlast anything.

### Gear Quality Matters
A "PERFECT ROLL" uncommon can beat a badly-rolled rare. Always compare quality scores when deciding what to equip.

### Follower Investment
Upgrading a follower 3 times (90 dust total) gives ~52% more combat stats. For legendary followers this is game-changing. Best value craft: Rare followers at 40 dust — strong combat stats for the cost.

### Dungeon Clear Scaling
Each dungeon clear makes the next run harder (+15% enemy stats). But your gear and followers carry over. Invest in good followers and high-rarity gear to stay ahead of the scaling curve.

### Telegraphed Attacks
When a monster telegraphs a special (yellow warning text), you have one turn to prepare:
- **Heavy Strike incoming?** Use Static Shield or Smoke Bomb
- **Enrage incoming?** Burst the monster down or use crowd control
- **War Stomp incoming?** Hope for evasion, or eat the stun and plan your next move
- **Heal incoming?** Go all-in on damage to counteract it

### Build Synergies
Some strong skill combos:
- **Chain Lightning + Frost Nova** — Stun, then freeze for extended CC
- **Shadow Step + Charge** — Stealth 3x into Charge for massive burst
- **Envenom + Rupture** — Stack poison bleeds, then detonate
- **Battle Trance + Thorns** — Trade DEF for offense while reflecting damage
- **Riposte + Static Shield** — Counter + shield for defensive turns
- **Marked for Death + Bloodlust** — Vulnerability amp into extra attack

---

*Good luck in the arena, adventurer!*
