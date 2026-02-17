class_name FollowerAbilities
## Port of follower ability functions from src/data/followers.js abilityFn callbacks.
## Called by CombatEngine._tick_arena_followers() via execute_ability().


static func execute_ability(af: Dictionary, tgt: Dictionary, t: int, eng: Node) -> void:
	var name: String = af.get("ability_name", "")
	match name:
		"Scorch": _scorch(af, tgt, t, eng)
		"Fortify": _fortify(af, tgt, t, eng)
		"Gnaw": _gnaw(af, tgt, t, eng)
		"Spark": _spark(af, tgt, t, eng)
		"Burrow": _burrow(af, tgt, t, eng)
		"Frostbite": _frostbite(af, tgt, t, eng)
		"Dive Bomb": _dive_bomb(af, tgt, t, eng)
		"Shell Bash": _shell_bash(af, tgt, t, eng)
		"Poison Fangs": _poison_fangs(af, tgt, t, eng)
		"Life Drain": _life_drain(af, tgt, t, eng)
		"Fire Breath": _fire_breath(af, tgt, t, eng)
		"Crystal Shield": _crystal_shield(af, tgt, t, eng)
		"Ambush": _ambush(af, tgt, t, eng)
		"Chain Shock": _chain_shock(af, tgt, t, eng)
		"Rebirth": pass  # Handled by on_death
		"Void Rip": _void_rip(af, tgt, t, eng)
		"Nature Heal": _nature_heal(af, tgt, t, eng)
		"Chaos Blast": _chaos_blast(af, tgt, t, eng)
		"Soul Reap": _soul_reap(af, tgt, t, eng)


static func execute_on_death(af: Dictionary, t: int, eng: Node) -> bool:
	var name: String = af.get("ability_name", "")
	if name == "Rebirth":
		return _rebirth_on_death(af, t, eng)
	return false


# ============ COMMON ============

# Fire Imp — Burns target, -6 DEF for 3s
static func _scorch(af: Dictionary, tgt: Dictionary, t: int, eng: Node) -> void:
	var debuffs: Array = tgt.get("_debuffs", [])
	debuffs.append({"type": "def", "val": -6, "end": t + 3000, "src": "Scorch"})
	tgt["_debuffs"] = debuffs
	eng._sp_float(float(tgt.get("x", 0)), float(tgt.get("y", 0)) - 45, "-DEF", "#ff6622")
	eng._add_log(t, str(af.get("name", "")) + " Scorches!", "spell")


# Stone Golem — Taunts, gains +12 DEF for 4s
static func _fortify(af: Dictionary, tgt: Dictionary, t: int, eng: Node) -> void:
	var buffs: Array = af.get("_buffs", [])
	buffs.append({"type": "def", "val": 12, "end": t + 4000})
	af["_buffs"] = buffs
	eng._sp_float(float(af.get("x", 0)), float(af.get("y", 0)) - 40, "+DEF", "#aaaaaa")
	eng._add_log(t, str(af.get("name", "")) + " Fortifies!", "spell")


# Shadow Rat — Bleeds target for 2s
static func _gnaw(af: Dictionary, tgt: Dictionary, t: int, eng: Node) -> void:
	if tgt.has("bleed_stacks"):
		CombatMath.add_bleed(tgt, t)
	eng._sp_float(float(tgt.get("x", 0)), float(tgt.get("y", 0)) - 40, "BLEED", "#cc3300")
	eng._add_log(t, str(af.get("name", "")) + " Gnaws!", "dmg")


# Ember Sprite — Zaps for 40 true dmg
static func _spark(af: Dictionary, tgt: Dictionary, t: int, eng: Node) -> void:
	tgt["hp"] = float(tgt.get("hp", 0)) - 40.0
	af["tot_dmg"] = float(af.get("tot_dmg", 0)) + 40.0
	tgt["hurt_anim"] = 1.0
	eng._sp_float(float(tgt.get("x", 0)), float(tgt.get("y", 0)) - 45, "-40", "#ffdd44")
	eng._add_log(t, str(af.get("name", "")) + " Sparks!", "shock")


# Mud Crawler — Heals self 60 HP
static func _burrow(af: Dictionary, _tgt: Dictionary, _t: int, eng: Node) -> void:
	af["hp"] = minf(float(af.get("max_hp", 650)), float(af.get("hp", 0)) + 60.0)
	eng._sp_float(float(af.get("x", 0)), float(af.get("y", 0)) - 40, "+60", "#44aa66")
	eng._add_log(_t, str(af.get("name", "")) + " Burrows!", "spell")


# ============ UNCOMMON ============

# Frost Wolf — Slows target 25% for 3s
static func _frostbite(af: Dictionary, tgt: Dictionary, t: int, eng: Node) -> void:
	tgt["slow"] = 0.25
	tgt["slow_end"] = t + 3000
	eng._sp_float(float(tgt.get("x", 0)), float(tgt.get("y", 0)) - 45, "SLOW", "#66ccff")
	eng._add_log(t, str(af.get("name", "")) + " Frostbite!", "shock")


# Thunder Hawk — 90 dmg + stun 0.5s
static func _dive_bomb(af: Dictionary, tgt: Dictionary, t: int, eng: Node) -> void:
	var dm: float = 90.0
	tgt["hp"] = float(tgt.get("hp", 0)) - dm
	af["tot_dmg"] = float(af.get("tot_dmg", 0)) + dm
	tgt["hurt_anim"] = 1.0
	if tgt.has("stun_end"):
		tgt["stun_end"] = t + 500
	eng._sp_float(float(tgt.get("x", 0)), float(tgt.get("y", 0)) - 50, "-90 STUN", "#ffdd44")
	eng._add_log(t, str(af.get("name", "")) + " Dive Bombs!", "shock")


# Iron Beetle — 60 dmg + knocks back
static func _shell_bash(af: Dictionary, tgt: Dictionary, t: int, eng: Node) -> void:
	var dm: float = 60.0
	tgt["hp"] = float(tgt.get("hp", 0)) - dm
	af["tot_dmg"] = float(af.get("tot_dmg", 0)) + dm
	tgt["hurt_anim"] = 1.0
	var push_dir: float = 1.0 if float(tgt.get("x", 0)) > float(af.get("x", 0)) else -1.0
	tgt["x"] = clampf(float(tgt.get("x", 0)) + push_dir * 40.0, float(CombatConstants.AX) + 25.0, float(CombatConstants.AX + CombatConstants.AW) - 25.0)
	eng._sp_float(float(tgt.get("x", 0)), float(tgt.get("y", 0)) - 45, "BASH", "#aaaa66")
	eng._add_log(t, str(af.get("name", "")) + " Shell Bash!", "dmg")


# Venom Spider — Poisons: 3 bleeds
static func _poison_fangs(af: Dictionary, tgt: Dictionary, t: int, eng: Node) -> void:
	if tgt.has("bleed_stacks"):
		CombatMath.add_bleed(tgt, t)
		CombatMath.add_bleed(tgt, t)
		CombatMath.add_bleed(tgt, t)
	eng._sp_float(float(tgt.get("x", 0)), float(tgt.get("y", 0)) - 45, "POISON", "#66aa22")
	eng._add_log(t, str(af.get("name", "")) + " Poisons!", "poison")


# Bone Wraith — 50 dmg, heals owner 50
static func _life_drain(af: Dictionary, tgt: Dictionary, t: int, eng: Node) -> void:
	var dm: float = 50.0
	tgt["hp"] = float(tgt.get("hp", 0)) - dm
	af["tot_dmg"] = float(af.get("tot_dmg", 0)) + dm
	tgt["hurt_anim"] = 1.0
	var owner: Dictionary = eng.h1 if af.get("owner_side", "left") == "left" else eng.h2
	owner["hp"] = minf(float(owner.get("max_hp", 1)), float(owner.get("hp", 0)) + 50.0)
	owner["tot_heal"] = float(owner.get("tot_heal", 0)) + 50.0
	eng._sp_float(float(tgt.get("x", 0)), float(tgt.get("y", 0)) - 45, "-50", "#aa77dd")
	eng._sp_float(float(owner.get("x", 0)), float(owner.get("y", 0)) - 55, "+50", "#44aa66")
	eng._add_log(t, str(af.get("name", "")) + " drains life!", "spell")


# ============ RARE ============

# Flame Drake — 120 AoE dmg to all enemies
static func _fire_breath(af: Dictionary, _tgt: Dictionary, t: int, eng: Node) -> void:
	var enemy: Dictionary = eng.h1 if af.get("owner_side", "left") != "left" else eng.h2
	enemy["hp"] = float(enemy.get("hp", 0)) - 120.0
	enemy["hurt_anim"] = 1.0
	af["tot_dmg"] = float(af.get("tot_dmg", 0)) + 120.0
	eng._sp_float(float(enemy.get("x", 0)), float(enemy.get("y", 0)) - 55, "-120", "#ff6622")
	# Damage enemy arena followers
	var e_afs: Array = enemy.get("arena_followers", [])
	for ef in e_afs:
		if ef.get("alive", false):
			ef["hp"] = float(ef.get("hp", 0)) - 60.0
			ef["hurt_anim"] = 1.0
	eng._add_log(t, str(af.get("name", "")) + " breathes fire!", "ult")


# Crystal Elemental — Grants owner 180 shield
static func _crystal_shield(af: Dictionary, _tgt: Dictionary, t: int, eng: Node) -> void:
	var owner: Dictionary = eng.h1 if af.get("owner_side", "left") == "left" else eng.h2
	owner["shield_active"] = true
	owner["shield_hp"] = float(owner.get("shield_hp", 0)) + 180.0
	owner["shield_end"] = t + 5000
	eng._sp_float(float(owner.get("x", 0)), float(owner.get("y", 0)) - 55, "+SHIELD", "#88ddff")
	eng._add_log(t, str(af.get("name", "")) + " shields owner!", "spell")


# Shadow Panther — 150 crit dmg from stealth
static func _ambush(af: Dictionary, tgt: Dictionary, t: int, eng: Node) -> void:
	var dm: float = 150.0
	tgt["hp"] = float(tgt.get("hp", 0)) - dm
	af["tot_dmg"] = float(af.get("tot_dmg", 0)) + dm
	tgt["hurt_anim"] = 1.0
	eng._sp_float(float(tgt.get("x", 0)), float(tgt.get("y", 0)) - 50, "-150 CRIT", "#ffffff")
	eng._add_log(t, str(af.get("name", "")) + " Ambush!", "stealth")


# Storm Serpent — 80 dmg + shocks 3s
static func _chain_shock(af: Dictionary, tgt: Dictionary, t: int, eng: Node) -> void:
	var dm: float = 80.0
	tgt["hp"] = float(tgt.get("hp", 0)) - dm
	af["tot_dmg"] = float(af.get("tot_dmg", 0)) + dm
	tgt["hurt_anim"] = 1.0
	tgt["shocked"] = true
	tgt["shocked_end"] = t + 3000
	eng._sp_float(float(tgt.get("x", 0)), float(tgt.get("y", 0)) - 50, "-80 SHOCK", "#44ddbb")
	eng._add_log(t, str(af.get("name", "")) + " Chain Shock!", "shock")


# ============ EPIC ============

# Phoenix — Rebirth (on death)
static func _rebirth_on_death(af: Dictionary, t: int, eng: Node) -> bool:
	if af.get("_reborn", false):
		return false
	af["_reborn"] = true
	af["alive"] = true
	af["hp"] = float(af.get("max_hp", 1)) * 0.5
	eng._sp_float(float(af.get("x", 0)), float(af.get("y", 0)) - 45, "REBIRTH!", "#ffcc22")
	eng._add_log(t, str(af.get("name", "")) + " is reborn!", "ult")
	return true


# Void Stalker — 140 dmg + steals 10% AS for 4s
static func _void_rip(af: Dictionary, tgt: Dictionary, t: int, eng: Node) -> void:
	var dm: float = 140.0
	tgt["hp"] = float(tgt.get("hp", 0)) - dm
	af["tot_dmg"] = float(af.get("tot_dmg", 0)) + dm
	tgt["hurt_anim"] = 1.0
	var debuffs: Array = tgt.get("_debuffs", [])
	debuffs.append({"type": "as", "val": -0.1, "end": t + 4000, "src": "VoidRip"})
	tgt["_debuffs"] = debuffs
	af["base_as"] = float(af.get("base_as", 1.0)) + 0.12
	eng._sp_float(float(tgt.get("x", 0)), float(tgt.get("y", 0)) - 50, "-140 -AS", "#8866cc")
	eng._add_log(t, str(af.get("name", "")) + " Void Rip!", "ult")


# Ancient Treant — Heals owner hero 200 HP
static func _nature_heal(af: Dictionary, _tgt: Dictionary, t: int, eng: Node) -> void:
	var owner: Dictionary = eng.h1 if af.get("owner_side", "left") == "left" else eng.h2
	var heal: float = 200.0
	owner["hp"] = minf(float(owner.get("max_hp", 1)), float(owner.get("hp", 0)) + heal)
	owner["tot_heal"] = float(owner.get("tot_heal", 0)) + heal
	eng._sp_float(float(owner.get("x", 0)), float(owner.get("y", 0)) - 55, "+200", "#44aa66")
	eng._add_log(t, str(af.get("name", "")) + " heals owner!", "spell")


# ============ LEGENDARY ============

# Chaos Dragon — 200 AoE + stun 1s + burn
static func _chaos_blast(af: Dictionary, _tgt: Dictionary, t: int, eng: Node) -> void:
	var enemy: Dictionary = eng.h1 if af.get("owner_side", "left") != "left" else eng.h2
	enemy["hp"] = float(enemy.get("hp", 0)) - 200.0
	enemy["hurt_anim"] = 1.0
	af["tot_dmg"] = float(af.get("tot_dmg", 0)) + 200.0
	if enemy.has("stun_end"):
		enemy["stun_end"] = t + 1000
	if enemy.has("bleed_stacks"):
		CombatMath.add_bleed(enemy, t)
		CombatMath.add_bleed(enemy, t)
	eng._sp_float(float(enemy.get("x", 0)), float(enemy.get("y", 0)) - 60, "-200 STUN", "#ffcc22")
	# Damage enemy arena followers
	var e_afs: Array = enemy.get("arena_followers", [])
	for ef in e_afs:
		if ef.get("alive", false):
			ef["hp"] = float(ef.get("hp", 0)) - 90.0
			ef["hurt_anim"] = 1.0
	eng._add_log(t, str(af.get("name", "")) + " CHAOS BLAST!", "ult")


# Death Knight — 160 dmg, heals self+owner 100
static func _soul_reap(af: Dictionary, tgt: Dictionary, t: int, eng: Node) -> void:
	var dm: float = 160.0
	tgt["hp"] = float(tgt.get("hp", 0)) - dm
	af["tot_dmg"] = float(af.get("tot_dmg", 0)) + dm
	tgt["hurt_anim"] = 1.0
	af["hp"] = minf(float(af.get("max_hp", 1)), float(af.get("hp", 0)) + 100.0)
	var owner: Dictionary = eng.h1 if af.get("owner_side", "left") == "left" else eng.h2
	owner["hp"] = minf(float(owner.get("max_hp", 1)), float(owner.get("hp", 0)) + 100.0)
	owner["tot_heal"] = float(owner.get("tot_heal", 0)) + 100.0
	eng._sp_float(float(tgt.get("x", 0)), float(tgt.get("y", 0)) - 50, "-160", "#aa44aa")
	eng._sp_float(float(af.get("x", 0)), float(af.get("y", 0)) - 40, "+100", "#44aa66")
	eng._sp_float(float(owner.get("x", 0)), float(owner.get("y", 0)) - 55, "+100", "#44aa66")
	eng._add_log(t, str(af.get("name", "")) + " Soul Reap!", "ult")
