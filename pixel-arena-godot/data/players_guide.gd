extends RefCounted
## Structured player's guide content as BBCode sections for in-game viewer.
class_name PlayersGuide

const SECTIONS: Array[Dictionary] = [
	{
		"title": "Getting Started",
		"content": """[color=#ffd700][b]Getting Started[/b][/color]

Create a character by picking one of four classes, naming your hero, and choosing 2 skills + 1 ultimate. You start with starter-tier gear in all 5 equipment slots.

From the [color=#88ccff]Character Forge[/color] hub you can manage equipment, followers, and launch into any game mode.

You have [color=#ffd700]3 save slots[/color] for different characters. Progress auto-saves.

[color=#aaaaaa]Game Modes:[/color]
  [color=#44ff88]Dungeon[/color] — Roguelike PvE, 8 floors of turn-based combat
  [color=#44ff88]Ladder[/color] — Infinite real-time PvE gauntlet
  [color=#44ff88]Arena[/color] — Online PvP against other players' builds
  [color=#44ff88]Craft[/color] — Spend dust to create followers"""
	},
	{
		"title": "Classes",
		"content": """[color=#ffd700][b]Character Classes[/b][/color]

[color=#44ddbb][b]Iron Mage "Voltaris"[/b][/color] — Ranged spellcaster
  HP 3900 | DMG 115 | AS 0.75 | DEF 45 | Mana 650
  [color=#aaaaaa]Charge stacks: +6% spell/basic dmg per stack (max 10)
  High spell damage, strong shields, no evasion[/color]

[color=#ff8844][b]Flame Ranger "Pyralis"[/b][/color] — Ranged bleed specialist
  HP 5000 | DMG 180 | AS 1.05 | DEF 58 | Eva 10%
  [color=#aaaaaa]Every 3rd attack bleeds (1% current HP/s, 2s)
  Bloodlust: +5% AS per active bleed on target[/color]

[color=#88ccff][b]Frost Blade "Glacier"[/b][/color] — Melee burst/stealth
  HP 4500 | DMG 140 | AS 1.1 | DEF 42 | Eva 18%
  [color=#aaaaaa]Combo stacks: +6% AS per hit (max 5)
  Stealth: +50% eva, next attack 3x dmg, +30% melee bonus[/color]

[color=#ff4444][b]Blood Warlord "Gorath"[/b][/color] — Melee tank/berserker
  HP 5500 | DMG 210 | AS 0.85 | DEF 65 | Lifesteal 3%
  [color=#aaaaaa]Rage: up to +45% dmg, +35% AS at low HP
  50% stun resist, 40% slow resist, 15% spell dodge[/color]"""
	},
	{
		"title": "Skills",
		"content": """[color=#ffd700][b]Skills & Ultimates[/b][/color]

Pick [color=#44ff88]2 skills[/color] + [color=#44ff88]1 ultimate[/color] at creation. Any class can use any skills.

[color=#44ddbb][b]Mage Skills[/b][/color]
  Chain Lightning — 35 mana, 2T cd — Damage + stun
  Lightning Bolt — 20 mana, 1T cd — Quick damage
  Static Shield — 45 mana, 3T cd — Absorb shield (380+DEF*5)
  Frost Nova — 30 mana, 2T cd — Damage + slow 2T
  Arcane Drain — 25 mana, 3T cd — Damage + heal

[color=#ff8844][b]Ranger Skills[/b][/color]
  Hunter's Mark — 15, 3T cd — -15% eva + slow 2T
  Bloodlust — 25, 4T cd — Extra attack + 15% lifesteal
  Summon Pet — 30, 5T cd — Companion strike (50% DMG)
  Rupture — 20, 2T cd — Detonate all bleed stacks
  Marked for Death — 20, 2-3T cd — +12-20% vuln for 2T (dungeon), +8-16% (arena)

[color=#88ccff][b]Rogue Skills[/b][/color]
  Shadow Step — 25 energy, 1T cd — Enter stealth (3x dmg)
  Envenom — 25 energy, 3T cd — 50% DMG + 2 poison stacks (3T)
  Smoke Bomb — 35 energy, 4T cd — +35%+ evasion 1T
  Lacerate — 30 energy, 3T cd — Scales w/ missing HP + bleed
  Riposte — 25 energy, 3T cd — Counter-attack when hit

[color=#ff4444][b]Warrior Skills[/b][/color]
  Charge — Free, 2T cd — 1.5x DMG+DEF + stun
  War Cry — Free, 3T cd — Weaken enemy -15% dmg
  Battle Trance — Free, 3T cd — 60% DEF to DMG for 2T
  Thorns — Free, 4T cd — Reflect 15-50% dmg for 2T"""
	},
	{
		"title": "Ultimates",
		"content": """[color=#ffd700][b]Ultimates[/b][/color]

One use per combat. In dungeon: manual activation. In arena/ladder: auto-triggers at low HP.

[color=#44ddbb][b]Mage[/b][/color]
  [color=#ffd700]Thunderstorm[/color] — 5 lightning strikes + heals 42% of dmg dealt
  [color=#ffd700]Arcane Overload[/color] — Big burst + all skills free 2+ turns + burn

[color=#ff8844][b]Ranger[/b][/color]
  [color=#ffd700]Rain of Fire[/color] — Invulnerable 1T + extra attacks + burn 3T
  [color=#ffd700]Primal Fury[/color] — Extra attack + poison on every hit 3+ rounds

[color=#88ccff][b]Rogue[/b][/color]
  [color=#ffd700]Death Mark[/color] — Track all dmg 2+ turns, detonate 75%
  [color=#ffd700]Shadow Dance[/color] — Persistent stealth (3x dmg) 3+ rounds

[color=#ff4444][b]Warrior[/b][/color]
  [color=#ffd700]Berserker Rage[/color] — +25%+ dmg, +40% AS buff 2+ rounds
  [color=#ffd700]Last Stand[/color] — Cannot die 2+ rounds, heals 20% when expires"""
	},
	{
		"title": "Gear",
		"content": """[color=#ffd700][b]Gear & Equipment[/b][/color]

[color=#aaaaaa]5 slots:[/color] Weapon, Helmet, Chest, Boots, Accessory

[color=#ffd700][b]Rarity Tiers[/b][/color]
  [color=#8a8a7a]Starter[/color]    95-100% range   0 dust
  [color=#b0b098]Common[/color]     75-115% range   1 dust
  [color=#44aa44]Uncommon[/color]   80-120% range   3 dust
  [color=#4488ff]Rare[/color]       85-125% range   8 dust
  [color=#aa44ff]Epic[/color]       88-130% range   20 dust
  [color=#ffd700]Legendary[/color]  92-135% range   50 dust
  [color=#ff4444]Mythic[/color]     95-140% range   120 dust

[color=#ffd700][b]Quality Score[/b][/color] (0-100)
  [color=#ffd700]95-100: PERFECT ROLL[/color]
  [color=#44ff88]80-94: Excellent[/color]
  [color=#44ddbb]60-79: Good[/color]

[color=#aaaaaa]A perfect uncommon can beat a badly-rolled rare![/color]

[color=#ffd700][b]Gear in Dungeon[/b][/color]
  Equip — Wear it (old piece goes to stash)
  Stash — Save for later
  Salvage — Convert to dust

Drop rarity scales with floor number and dungeon clears.

[color=#ffd700][b]Gear Affixes[/b][/color]
Rare+ gear rolls special bonus properties (affixes).
  [color=#b0b098]Starter-Uncommon:[/color] 1-2 basic affixes
  [color=#4488ff]Rare:[/color] 2 basic+mid affixes
  [color=#aa44ff]Epic-Legendary:[/color] 3 basic+mid+high affixes
  [color=#ff4444]Mythic:[/color] 4 affixes from all tiers

[color=#aaaaaa]Basic:[/color] Crit chance, Lifesteal, Thorns, HP regen, Mana regen, Bonus HP, Bonus DEF
[color=#44ff88]Mid:[/color] Fire/Ice/Lightning dmg, Damage reduction, Frenzy (AS on hit), Chilling (slow on hit)
[color=#ffd700]High:[/color] Thunderstrike (chain lightning proc), Thorn Aura, Executioner (heal on kill)
[color=#ff4444]Mythic:[/color] Spellweaver (extra skill cast), Shadow Reaper (stealth on kill), Twin Strike, Aura of Might"""
	},
	{
		"title": "Followers",
		"content": """[color=#ffd700][b]Followers & Companions[/b][/color]

Fight alongside you + give passive stat buffs. Deploy 1 companion at a time.

[color=#ffd700][b]Acquiring[/b][/color]
  Dungeon cages — Room events
  Combat drops — 8% regular, 25% boss
  Ladder rewards — Every 3 wins
  Crafting — Common 5, Uncommon 15, Rare 40, Epic 100, Legendary 250 dust

[color=#ffd700][b]Upgrading[/b][/color] — 30 dust each, max 3 upgrades
  Each: +15% HP, +15% DMG, +15% DEF (stacks = ~52% boost at max)

[color=#ffd700][b]Dungeon Abilities[/b][/color] (auto-use on companion turn)
  Tank types — Shield you (30% of their max HP)
  Healer types — Heal you (10% of your max HP)
  Stun types — Stun the monster
  DPS types — Big damage hit (3x their DMG)

[color=#b0b098][b]Common:[/b][/color] Fire Imp, Stone Golem, Shadow Rat, Ember Sprite, Mud Crawler
[color=#44aa44][b]Uncommon:[/b][/color] Frost Wolf, Thunder Hawk, Iron Beetle, Venom Spider, Bone Wraith
[color=#4488ff][b]Rare:[/b][/color] Flame Drake, Crystal Elemental, Shadow Panther, Storm Serpent
[color=#aa44ff][b]Epic:[/b][/color] Phoenix (revives!), Void Stalker, Ancient Treant
[color=#ffd700][b]Legendary:[/b][/color] Chaos Dragon, Death Knight"""
	},
	{
		"title": "Dungeon",
		"content": """[color=#ffd700][b]Dungeon Mode[/b][/color]

[color=#44ff88]8 Floors[/color] x [color=#44ff88]3 Rooms[/color] = 24 total rooms
Room 3 is always a [color=#ff4444]Boss[/color]. Rooms 1-2 are random events.
Enter at [color=#44ff88]85% max HP[/color] with 3 potions.

[color=#ffd700][b]Room Types[/b][/color]
  [color=#ff4444]Combat[/color] — Fight a monster. Boss: x1.8 HP, x1.4 DMG, x1.3 DEF
  [color=#ffd700]Treasure[/color] — Free gold + chance for items + 50% gear drop
  [color=#ff8844]Trap[/color] — Endure (DEF-reduced dmg) or Dodge (eva+20% chance)
  [color=#44ff88]Rest[/color] — Heal 25% max HP (floor 2+)
  [color=#aa44ff]Shrine[/color] — Costs 15% HP, grants run buff:
    Power +35 DMG | Vitality +500 HP | Iron +25 DEF
    Shadows +8% Eva | Fury +0.2 AS
  [color=#44ddbb]Merchant[/color] — Buy potions, tomes, scrolls, gear (floor 3+)
  [color=#88ccff]Cage[/color] — Rescue a follower (keep or release for gold)

[color=#ffd700][b]Difficulty Scaling[/b][/color]
  +15% enemy stats per dungeon clear
  +1 monster tier every 2 clears (up to +2)

[color=#ffd700][b]Monsters[/b][/color]
  Tier 1: Goblin, Bat, Slime, Skeleton
  Tier 2: Orc, Dark Mage, Troll, Ghost (20% eva!), Mimic
  Tier 3: Minotaur, Lich, Stone Golem (50 DEF!), Wyvern, Fungal Horror, Yeti
  Tier 4: Dragon, Demon Lord, Ancient Wyrm (3200 HP!), Kraken"""
	},
	{
		"title": "Combat",
		"content": """[color=#ffd700][b]Dungeon Combat[/b][/color]

Turn-based [color=#44ff88]AP timeline[/color] system.

[color=#ffd700][b]How Turns Work[/b][/color]
Each combatant has a Speed (60-200). Every tick, gain AP = speed.
At 100 AP, take your turn. Higher speed = more frequent turns.
The [color=#88ccff]turn order strip[/color] shows the next 5 turns.

[color=#ffd700][b]Your Actions[/b][/color]
  ATK — Basic attack
  Skill 1 / Skill 2 — Costs mana/energy + turn cooldown
  Ultimate — One-time powerful ability
  Potion — Heal 35% max HP (limited supply)
  Flee — 50% + evasion chance to escape
  Auto — Toggle auto-battle AI

[color=#ffd700][b]Skill Cooldowns[/b][/color]
Skills need BOTH enough mana AND cooldown = 0.
After use, goes on cooldown for N turns (shown as "2T").
Mana regenerates each monster turn (mana_regen x 2).

[color=#ffd700][b]Damage Formula[/b][/color]
  dmg = base_dmg x (1 - min(DEF/300, 0.8)) x rand(0.85-1.15)
  Crit: 5% base chance in dungeon, 1.75x damage (gear affixes add crit in all modes)
  Stealth: 3x damage
  Vulnerability: +bonus % from Marked for Death

[color=#ffd700][b]Frost Slow[/b][/color]
Slowed enemies lose [color=#ff4444]35% speed[/color]. Fewer monster turns = huge advantage.
Applied by Hunter's Mark and Frost Nova.

[color=#ffd700][b]Fatigue[/b][/color] (turn 50+)
Monster takes escalating % dmg. You can outlast anything."""
	},
	{
		"title": "Ladder",
		"content": """[color=#ffd700][b]Ladder Mode[/b][/color]

Infinite sequence of [color=#44ff88]real-time combat[/color] opponents.

[color=#ffd700][b]Structure[/b][/color]
  Fights 1-4: Fixed NPC classes at 70% stats
  Fight 5+: Procedural opponents with scaling stats

[color=#ffd700][b]Scaling[/b][/color] (fight 5+)
  HP: 3200 + (wins-3) x 140
  DMG: 80 + (wins-3) x 6
  DEF: 20 + (wins-3) x 2
  Plus random equipment bonuses

[color=#ffd700][b]Rewards[/b][/color]
  Every 3 wins: earn a rare+ follower
  Best run and total wins tracked permanently

[color=#ffd700][b]Tips[/b][/color]
  Select your best companion before each fight
  First 4 fights are warmups
  Watch for stun-lock builds on opponents"""
	},
	{
		"title": "Arena",
		"content": """[color=#ffd700][b]Arena (Online PvP)[/b][/color]

[color=#ffd700][b]How It Works[/b][/color]
  1. Upload your build (stats, skills, gear, followers)
  2. Browse other players' builds
  3. Select a champion follower ([color=#ff4444]wagered![/color])
  4. Fight in real-time combat
  5. Win/Loss recorded for both players

[color=#ff4444][b]Warning:[/b][/color] Your champion follower is [color=#ff4444]at risk[/color]!
Lose the match = lose the follower. Don't wager what you can't afford!

[color=#aaaaaa]Upload your build after gear upgrades.
Arena followers take 30% reduced damage from heroes.[/color]"""
	},
	{
		"title": "Currencies",
		"content": """[color=#ffd700][b]Currencies & Progression[/b][/color]

[color=#ffd700][b]Gold[/b][/color] — Per-run dungeon currency
  Earned: combat, treasure rooms, selling followers
  Spent: merchant rooms during runs

[color=#88ccff][b]Dust[/b][/color] — Permanent crafting currency
  Earned: salvage gear (1-120 by rarity), release followers (3-300)
  Spent: craft followers (5-250), upgrade followers (30 each)

[color=#44ff88][b]Potions[/b][/color] — Start each run with 3
  Buy more at merchants (20g each)
  Each heals 35% max HP

[color=#ffd700][b]How You Get Stronger[/b][/color]
  1. Better gear — Scales with floor and clears
  2. Followers — Passive buffs + combat companion
  3. Follower upgrades — 30 dust each, up to 3x
  4. Shrine buffs — Permanent for that run only
  5. Skill/ultimate optimization"""
	},
	{
		"title": "Strategy",
		"content": """[color=#ffd700][b]Strategy Tips[/b][/color]

[color=#44ff88][b]Defense Matters[/b][/color]
DEF reduces dmg by DEF/300 (cap 80%). At 120 DEF = 40% reduction. Linear scaling — every point counts.

[color=#44ff88][b]Speed Wins Dungeons[/b][/color]
120 speed = ~2x turns vs 60 speed. Invest in AS to snowball.

[color=#44ff88][b]Stealth is Powerful[/b][/color]
Shadow Step gives 3x damage. Combo with Charge for massive burst.
Shadow Dance ult = persistent 3x damage for 3+ rounds.

[color=#44ff88][b]Bleed Stacking[/b][/color]
Bleeds: 30% DMG/turn. Stack with Envenom + Lacerate, detonate with Rupture.

[color=#44ff88][b]Frost Slow[/b][/color]
-35% speed on monsters = fewer turns. Use Hunter's Mark or Frost Nova.

[color=#44ff88][b]Shrine Picks[/b][/color]
Cost 15% HP. Best choices depend on build:
  Power +35 DMG — Always good
  Vitality +500 HP — Survivability
  Iron +25 DEF — Great below 200 DEF
  Shadows +8% Eva — Amazing for eva builds
  Fury +0.2 AS — More speed = more turns

[color=#44ff88][b]Fatigue Safety Net[/b][/color]
Survive to turn 50 = monster takes escalating dmg. Stack potions + Last Stand.

[color=#44ff88][b]Skill Combos[/b][/color]
  Chain Lightning + Frost Nova — Stun then freeze
  Shadow Step + Charge — Stealth 3x into heavy burst
  Envenom + Rupture — Poison stacks then detonate
  Battle Trance + Thorns — Trade DEF for offense + reflect
  Marked for Death + Bloodlust — Vuln amp + extra attack"""
	},
]
