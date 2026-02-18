class_name CombatMath
## Pure combat math functions — 1:1 port of src/combat/engine.js utility functions.
## All functions are static. No side effects, no signals, no state mutation.

# ── Balance Constants ──
const STEALTH_DMG_MULT := 3.0
const CRIT_DMG_MULT := 1.75
const MAX_DEF_REDUCTION := 0.8
const DEF_DIVISOR := 300.0
const MAX_EVASION := 0.95
const SHOCKED_DMG_MULT := 1.1
const ASSASSIN_MELEE_MULT := 1.30
const CUSTOM_ULT_DMG_MULT := 1.2
const MAX_GEAR_DMG_REDUCTION := 0.25
const SMOKE_BOMB_EV_BONUS := 0.45
const STEALTH_EV_BONUS := 0.5

# Cached class data (loaded once)
static var _classes: Dictionary = {}


static func _load_classes() -> void:
	if not _classes.is_empty():
		return
	var file := FileAccess.open("res://data/classes.json", FileAccess.READ)
	if file:
		_classes = JSON.parse_string(file.get_as_text())
		file.close()


static func class_data(key: String) -> Dictionary:
	_load_classes()
	return _classes.get(key, {})


# ============ DISTANCE ============

static func dst(a: Dictionary, b: Dictionary) -> float:
	var dx := float(a.get("x", 0)) - float(b.get("x", 0))
	var dy := float(a.get("y", CombatConstants.GY)) - float(b.get("y", CombatConstants.GY))
	return sqrt(dx * dx + dy * dy)


# ============ BLEED / BURN ============

static func bleed_count(h: Dictionary) -> int:
	return h.get("bleed_stacks", []).size()


static func add_bleed(t: Dictionary, time: int) -> void:
	if not t.has("bleed_stacks"):
		t["bleed_stacks"] = []
	t["bleed_stacks"].append({"hp_snap": t.get("hp", 0), "at": time, "exp": time + 2000})


## Process bleed stacks (HP-snapshot DoT) and burn (flat fire DoT) per tick.
## Returns bleed damage dealt this tick.
static func proc_bleed(h: Dictionary, t: int, dt: int) -> float:
	var stacks: Array = h.get("bleed_stacks", [])
	# Remove expired stacks
	var i := stacks.size() - 1
	while i >= 0:
		if t >= stacks[i].get("exp", 0):
			stacks.remove_at(i)
		i -= 1

	var d: float = 0.0
	for s in stacks:
		d += float(s.get("hp_snap", 0)) * 0.01 * (float(dt) / 1000.0)
	if d > 0:
		h["hp"] = float(h.get("hp", 0)) - d

	# Burn (flat fire DoT)
	if h.get("burning", false) and t < h.get("burn_end", 0):
		h["hp"] = float(h.get("hp", 0)) - float(h.get("burn_dmg", 0)) * (float(dt) / 1000.0)

	return d


# ============ MOVEMENT SPEED ============

## Get effective movement speed, accounting for slow debuffs and barbarian resist.
## Port of JS getMS() (engine.js:19)
static func get_ms(h: Dictionary, bt: int) -> float:
	var s: float = float(h.get("move_speed", 100)) * (1.0 + float(h.get("move_speed_bonus", 0.0)))
	if float(h.get("slow", 0.0)) > 0.0 and bt < int(h.get("slow_end", 0)):
		var sr: float = float(h.get("slow", 0.0))
		if h.get("type", "") == "barbarian":
			sr *= (1.0 - float(class_data("barbarian").get("slow_resist", 0.0)))
		s *= (1.0 - sr)
	return s


# ============ STUN CHECK ============

## Port of JS isStunned() (engine.js:20)
static func is_stunned(h: Dictionary, bt: int) -> bool:
	var stun_end := int(h.get("stun_end", 0))
	if stun_end == 0 or bt >= stun_end:
		return false
	if h.get("type", "") == "barbarian":
		var resist := float(class_data("barbarian").get("stun_resist", 0.0))
		if resist > 0.0 and randf() < resist:
			return false
	return true


# ============ RAGE (BARBARIAN) ============

## Port of JS getRage() (engine.js:21)
static func get_rage(h: Dictionary) -> Dictionary:
	if h.get("type", "") != "barbarian":
		return {"d": 1.0, "a": 1.0}
	var c := class_data("barbarian")
	var m: float = 1.0 - float(h.get("hp", 1)) / maxf(1.0, float(h.get("max_hp", 1)))
	return {
		"d": 1.0 + m * float(c.get("rage_max_dmg", 0.0)),
		"a": 1.0 + m * float(c.get("rage_max_as", 0.0))
	}


# ============ EFFECTIVE ATTACK SPEED ============

## Port of JS effAS() (engine.js:22-29)
## Class-specific attack speed calculation.
static func eff_as(h: Dictionary, bt: int) -> float:
	if is_stunned(h, bt):
		return 0.001

	var hero_type: String = h.get("type", "")

	if hero_type == "wizard":
		var s: float = float(h.get("base_as", 0.75)) * (1.0 + float(h.get("cast_speed_bonus", 0.0)))
		if float(h.get("slow", 0.0)) > 0.0 and bt < int(h.get("slow_end", 0)):
			s *= (1.0 - float(h.get("slow", 0.0)))
		return s

	if hero_type == "assassin":
		var s: float = float(h.get("base_as", 1.1))
		if int(h.get("combo", 0)) > 0:
			s *= (1.0 + float(h.get("combo", 0)) * 0.06)
		if float(h.get("slow", 0.0)) > 0.0 and bt < int(h.get("slow_end", 0)):
			s *= (1.0 - float(h.get("slow", 0.0)))
		return s

	if hero_type == "barbarian":
		var s: float = float(h.get("base_as", 0.85)) * get_rage(h).a
		if h.get("ult_active", false):
			s *= (1.0 + float(class_data("barbarian").get("ult_as", 0.0)))
		if float(h.get("slow", 0.0)) > 0.0 and bt < int(h.get("slow_end", 0)):
			s *= (1.0 - float(h.get("slow", 0.0)) * (1.0 - float(class_data("barbarian").get("slow_resist", 0.0))))
		return s

	if hero_type == "custom":
		var s: float = float(h.get("base_as", 0.8))
		if h.get("ult_active", false):
			s *= 1.3
		if h.get("primal_active", false) and bt < int(h.get("primal_end", 0)):
			s *= 1.8
		if int(h.get("combo", 0)) > 0:
			s *= (1.0 + float(h.get("combo", 0)) * 0.04)
		if float(h.get("slow", 0.0)) > 0.0 and bt < int(h.get("slow_end", 0)):
			s *= (1.0 - float(h.get("slow", 0.0)))
		return s

	# Ranger (default)
	var s: float = float(h.get("base_as", 0.95)) * (1.0 + float(h.get("move_speed_bonus", 0.0)) * 0.5)
	if h.get("bl_active", false):
		s *= (1.0 + 0.05 * float(bleed_count(h)))
	if h.get("ult_active", false):
		s *= 3.0
	if float(h.get("slow", 0.0)) > 0.0 and bt < int(h.get("slow_end", 0)):
		s *= (1.0 - float(h.get("slow", 0.0)))
	return s


# ============ EFFECTIVE EVASION ============

## Port of JS effEv() (engine.js:30-35)
static func eff_ev(h: Dictionary, bt: int) -> float:
	if h.get("type", "") == "ranger" and h.get("ult_active", false):
		return 1.0
	var ev: float = float(h.get("evasion", 0.0))
	if h.get("stealthed", false):
		ev += STEALTH_EV_BONUS
	if h.get("smoke_bomb_active", false):
		ev += SMOKE_BOMB_EV_BONUS
	return minf(ev, MAX_EVASION)


# ============ SPELL DAMAGE MULTIPLIER ============

## Port of JS getSdm() (engine.js:49)
static func get_sdm(w: Dictionary) -> float:
	var m: float = 1.0 + float(w.get("spell_dmg_bonus", 0.0))
	m += float(w.get("charge", 0)) * 0.06
	return m


## Add wizard charge stacks (engine.js:50)
static func add_charge(w: Dictionary, n: int) -> void:
	w["charge"] = mini(int(w.get("max_charge", 10)), int(w.get("charge", 0)) + n)
	w["charge_decay_timer"] = 0


# ============ DAMAGE CALCULATION ============

## Port of JS calcDmg() (engine.js:36-48)
## CRITICAL: baseDmg * (1 - min(def/300, 0.8)) — NO attack speed multiplier!
static func calc_dmg(a: Dictionary, d: Dictionary, is_ranged: bool, dist: float, bt: int) -> float:
	var dm: float = float(a.get("base_dmg", 50)) * (1.0 - minf(float(d.get("def", 0)) / DEF_DIVISOR, MAX_DEF_REDUCTION))

	# Shocked: +10% damage taken
	if d.get("shocked", false) and bt < int(d.get("shocked_end", 0)):
		dm *= SHOCKED_DMG_MULT

	# Vulnerable: amplified damage
	if d.get("vulnerable", false) and bt < int(d.get("vulnerable_end", 0)):
		dm *= (1.0 + float(d.get("vulnerable_amp", 0.1)))

	# Ranged penalty at close range
	if is_ranged and dist < CombatConstants.MELEE:
		dm *= CombatConstants.RANGED_PEN

	# Stealth bonus
	if a.get("stealthed", false):
		dm *= STEALTH_DMG_MULT

	# Assassin melee bonus
	if a.get("type", "") == "assassin" and dist <= float(a.get("melee_range", CombatConstants.MELEE)):
		dm *= ASSASSIN_MELEE_MULT

	# Wizard charge bonus
	if a.get("type", "") == "wizard" and int(a.get("charge", 0)) > 0:
		dm *= (1.0 + float(a.get("charge", 0)) * 0.06)

	# Barbarian rage + ult + variance
	if a.get("type", "") == "barbarian":
		dm *= get_rage(a).d
		if a.get("ult_active", false):
			dm *= (1.0 + float(class_data("barbarian").get("ult_dmg", 0.0)))
		var variance := float(class_data("barbarian").get("dmg_variance", 0.0))
		if variance > 0.0:
			dm *= (1.0 + (randf() - 0.5) * 2.0 * variance)

	# Custom ult bonus
	if a.get("type", "") == "custom" and a.get("ult_active", false):
		dm *= CUSTOM_ULT_DMG_MULT

	# Stash crit (dungeon items)
	if float(a.get("_stash_crit", 0.0)) > 0.0 and randf() < float(a.get("_stash_crit", 0.0)):
		dm *= CRIT_DMG_MULT

	# Gear affix crit
	if float(a.get("_crit_chance", 0.0)) > 0.0 and randf() < float(a.get("_crit_chance", 0.0)):
		dm *= CRIT_DMG_MULT

	# Elemental damage bonus (highest element applies)
	var elem: float = maxf(maxf(float(a.get("_fire_dmg", 0.0)), float(a.get("_ice_dmg", 0.0))), float(a.get("_lightning_dmg", 0.0)))
	if elem > 0.0:
		dm *= (1.0 + elem)

	# Gear affix damage reduction on defender
	if float(d.get("_dmg_reduction", 0.0)) > 0.0:
		dm *= (1.0 - minf(float(d.get("_dmg_reduction", 0.0)), MAX_GEAR_DMG_REDUCTION))

	return dm
