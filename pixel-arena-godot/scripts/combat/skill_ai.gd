class_name SkillAI
## Port of ALL_SKILLS and ALL_ULTS AI functions from src/data/skills.js
## All functions are static. Called by CombatEngine._custom_ai().

# ============ DISPATCH ============

static func try_cast_skill(idx: int, h: Dictionary, t: int, eng: Node) -> bool:
	match idx:
		0: return _chain_lightning(h, t, eng)
		1: return _lightning_bolt(h, t, eng)
		2: return _static_shield(h, t, eng)
		3: return _hunters_mark(h, t, eng)
		4: return _bloodlust(h, t, eng)
		5: return _summon_pet(h, t, eng)
		6: return _shadow_step(h, t, eng)
		7: return _envenom(h, t, eng)
		8: return _smoke_bomb(h, t, eng)
		9: return _charge(h, t, eng)
		10: return _war_cry(h, t, eng)
		11: return _frost_nova(h, t, eng)
		12: return _arcane_drain(h, t, eng)
		13: return _rupture(h, t, eng)
		14: return _marked_for_death(h, t, eng)
		15: return _lacerate(h, t, eng)
		16: return _riposte(h, t, eng)
		17: return _battle_trance(h, t, eng)
		18: return _thorns(h, t, eng)
	return false


static func try_cast_ult(idx: int, h: Dictionary, t: int, eng: Node) -> bool:
	match idx:
		0: return _ult_thunderstorm(h, t, eng)
		1: return _ult_rain_of_fire(h, t, eng)
		2: return _ult_death_mark(h, t, eng)
		3: return _ult_berserker(h, t, eng)
		4: return _ult_arcane_overload(h, t, eng)
		5: return _ult_primal_fury(h, t, eng)
		6: return _ult_shadow_dance(h, t, eng)
		7: return _ult_last_stand(h, t, eng)
	return false


# ============ HELPERS ============

static func _en(h: Dictionary, eng: Node) -> Dictionary:
	return eng.en(h)

static func _dst(a: Dictionary, b: Dictionary) -> float:
	return CombatMath.dst(a, b)

static func _eff_ev(e: Dictionary) -> float:
	return CombatMath.eff_ev(e, 0)

static func _bleed_count(h: Dictionary) -> int:
	return CombatMath.bleed_count(h)

static func _add_bleed(tgt: Dictionary, t: int) -> void:
	CombatMath.add_bleed(tgt, t)

static func _set_cd(h: Dictionary, key: String, val: int) -> void:
	var spells: Dictionary = h.get("spells", {})
	if spells.has(key):
		spells[key]["cd"] = val
	# Also set by skill index key
	for sk in h.get("custom_skill_ids", []):
		if int(sk.get("idx", -1)) >= 0:
			var sk_key: String = str(sk.get("key", ""))
			if spells.has(sk_key):
				spells[sk_key]["cd"] = val
				break

static func _set_skill_cd(h: Dictionary, skill_idx: int, val: int) -> void:
	for sk in h.get("custom_skill_ids", []):
		if int(sk.get("idx", -1)) == skill_idx:
			var sk_key: String = str(sk.get("key", ""))
			var spells: Dictionary = h.get("spells", {})
			if spells.has(sk_key):
				spells[sk_key]["cd"] = val
			break

static func _def_reduction(def_val: float) -> float:
	return 1.0 - minf(def_val / 300.0, 0.8)


# ============ SKILLS (0-18) ============

# 0: Chain Lightning — 25 power, 5s CD, dmg=(180+maxHP*0.05)*sdm, stun+slow+shock
static func _chain_lightning(h: Dictionary, t: int, eng: Node) -> bool:
	var e := _en(h, eng)
	var d := _dst(h, e)
	if float(h.get("resource", 0)) < 25 or d > float(h.get("spell_range", 400)):
		return false
	h["resource"] = float(h.get("resource", 0)) - 25
	_set_skill_cd(h, 0, 5000)
	h["cast_anim"] = 1.0
	if randf() < _eff_ev(e) * 0.6:
		eng._add_log(t, "Chain DODGED!", "miss")
		return true
	var dm: float = (140.0 + float(h.get("max_hp", 1500)) * 0.04) * (1.0 + float(h.get("spell_dmg_bonus", 0.0))) * _def_reduction(float(e.get("def", 0)))
	e["hp"] = float(e.get("hp", 0)) - dm
	h["tot_dmg"] = float(h.get("tot_dmg", 0)) + dm
	e["hurt_anim"] = 1.0
	eng._sp_float(float(e.get("x", 0)), float(e.get("y", 0)) - 60, str(roundi(dm)), "#44ddbb")
	eng._add_log(t, "Chain>" + str(e.get("name", "")) + " " + str(roundi(dm)), "shock")
	e["shocked"] = true
	e["shocked_end"] = t + 3000
	e["slow"] = 0.10
	e["slow_end"] = t + 1500
	if not e.get("stealthed", false) and e.get("type", "") != "barbarian":
		e["stun_end"] = t + 300
	return true


# 1: Lightning Bolt — 15 power, 2.5s CD, dmg=(90+maxHP*0.03)*sdm, shock
static func _lightning_bolt(h: Dictionary, t: int, eng: Node) -> bool:
	var e := _en(h, eng)
	var d := _dst(h, e)
	if float(h.get("resource", 0)) < 15 or d > float(h.get("spell_range", 400)):
		return false
	h["resource"] = float(h.get("resource", 0)) - 15
	_set_skill_cd(h, 1, 2500)
	h["cast_anim"] = 1.0
	if randf() < _eff_ev(e) * 0.6:
		eng._add_log(t, "Bolt DODGED!", "miss")
		return true
	var dm: float = (90.0 + float(h.get("max_hp", 1500)) * 0.03) * (1.0 + float(h.get("spell_dmg_bonus", 0.0))) * _def_reduction(float(e.get("def", 0)))
	e["hp"] = float(e.get("hp", 0)) - dm
	h["tot_dmg"] = float(h.get("tot_dmg", 0)) + dm
	e["hurt_anim"] = 1.0
	eng._sp_float(float(e.get("x", 0)), float(e.get("y", 0)) - 50, str(roundi(dm)), "#88ffdd")
	eng._add_log(t, "Bolt>" + str(e.get("name", "")) + " " + str(roundi(dm)), "shock")
	e["shocked"] = true
	e["shocked_end"] = t + 2000
	return true


# 2: Static Shield — 35 power, 10s CD, absorb 380+def*5, when HP<70%
static func _static_shield(h: Dictionary, t: int, eng: Node) -> bool:
	if float(h.get("resource", 0)) < 35:
		return false
	if float(h.get("hp", 0)) / maxf(1.0, float(h.get("max_hp", 1))) > 0.70:
		return false
	if h.get("shield_active", false):
		return false
	h["resource"] = float(h.get("resource", 0)) - 35
	_set_skill_cd(h, 2, 10000)
	h["shield_active"] = true
	h["shield_hp"] = 380.0 + float(h.get("def", 0)) * 5.0
	h["shield_end"] = t + 6000
	h["cast_anim"] = 1.0
	eng._add_log(t, str(h.get("name", "")) + " Shield!", "spell")
	return true


# 3: Hunter's Mark — 10 power, 8s CD, flat slow + mark_next (no bleed required)
static func _hunters_mark(h: Dictionary, t: int, eng: Node) -> bool:
	var e := _en(h, eng)
	if float(h.get("resource", 0)) < 10:
		return false
	h["resource"] = float(h.get("resource", 0)) - 10
	var as_val: float = float(h.get("base_as", 0.5))
	e["slow"] = 0.08 + as_val * 0.06
	e["slow_end"] = t + 1500 + roundi(as_val * 1200.0)
	h["mark_next"] = true
	_add_bleed(e, t)
	_set_skill_cd(h, 3, 8000)
	h["cast_anim"] = 1.0
	eng._add_log(t, str(h.get("name", "")) + " Mark!", "spell")
	return true


# 4: Bloodlust — 20 power, 12s CD, immediate bonus hit + 15% lifesteal (requires 2+ bleeds)
static func _bloodlust(h: Dictionary, t: int, eng: Node) -> bool:
	var e := _en(h, eng)
	if _bleed_count(e) < 2:
		return false
	if float(h.get("resource", 0)) < 20:
		return false
	h["resource"] = float(h.get("resource", 0)) - 20
	_set_skill_cd(h, 4, 12000)
	h["cast_anim"] = 1.0
	# Immediate bonus hit
	var dm: float = float(h.get("base_dmg", 100)) * _def_reduction(float(e.get("def", 0)))
	dm *= randf_range(0.9, 1.1)
	e["hp"] = float(e.get("hp", 0)) - dm
	h["tot_dmg"] = float(h.get("tot_dmg", 0)) + dm
	e["hurt_anim"] = 1.0
	# 15% lifesteal from the hit
	var heal: float = dm * 0.15
	h["hp"] = minf(float(h.get("max_hp", 1)), float(h.get("hp", 0)) + heal)
	h["tot_heal"] = float(h.get("tot_heal", 0)) + heal
	eng._sp_float(float(e.get("x", 0)), float(e.get("y", 0)) - 60, str(roundi(dm)), "#cc4444")
	eng._sp_float(float(h.get("x", 0)), float(h.get("y", 0)) - 55, "+" + str(roundi(heal)), "#44aa66")
	eng._add_log(t, str(h.get("name", "")) + " Bloodlust " + str(roundi(dm)) + " heal " + str(roundi(heal)), "spell")
	return true


# 5: Summon Pet — 25 power, 15s CD, spawns follower with HP bonus from baseDmg
static func _summon_pet(h: Dictionary, t: int, eng: Node) -> bool:
	if h.get("follower_alive", false):
		return false
	if float(h.get("resource", 0)) < 25:
		return false
	h["resource"] = float(h.get("resource", 0)) - 25
	# Create follower via factory-style inline
	var max_hp := int(h.get("follower_max_hp", 450))
	var bonus := roundi(float(h.get("base_dmg", 0)))
	h["follower"] = {
		"alive": true,
		"hp": max_hp + bonus,
		"max_hp": max_hp + bonus,
		"x": float(h.get("x", 0)) + float(h.get("facing", 1)) * 40.0,
		"y": float(h.get("y", CombatConstants.GY)),
		"move_speed": 140,
		"attack_range": CombatConstants.MELEE,
		"goading": true,
		"goad_range": 120,
		"bob_phase": randf() * TAU,
		"hurt_anim": 0.0,
	}
	h["follower_alive"] = true
	_set_skill_cd(h, 5, 15000)
	h["cast_anim"] = 1.0
	eng._add_log(t, str(h.get("name", "")) + " summons pet!", "summon")
	return true


# 6: Shadow Step — 20 power, 3.5s CD, stealth + combo (teleport only if far)
static func _shadow_step(h: Dictionary, t: int, eng: Node) -> bool:
	var e := _en(h, eng)
	var d := _dst(h, e)
	if float(h.get("resource", 0)) < 20 or h.get("stealthed", false):
		return false
	h["resource"] = float(h.get("resource", 0)) - 20
	_set_skill_cd(h, 6, 3500)
	h["cast_anim"] = 1.0
	# Teleport behind only if far enough away
	if d > 100:
		var behind_offset := 50.0 if float(e.get("x", 0)) > float(h.get("x", 0)) else -50.0
		h["x"] = clampf(float(e.get("x", 0)) + behind_offset, float(CombatConstants.AX) + 25.0, float(CombatConstants.AX + CombatConstants.AW) - 25.0)
		h["y"] = float(e.get("y", h.get("y", CombatConstants.GY)))
	h["stealthed"] = true
	h["stealth_end"] = t + 1200 + roundi(float(h.get("move_speed", 160)) * 5.0)
	h["combo"] = mini(int(h.get("max_combo", 5)), int(h.get("combo", 0)) + 2)
	eng._add_log(t, str(h.get("name", "")) + " Shadow Step!", "stealth")
	return true


# 7: Envenom — 20 power, 8s CD, poison on attacks for duration
static func _envenom(h: Dictionary, t: int, eng: Node) -> bool:
	var e := _en(h, eng)
	var d := _dst(h, e)
	if float(h.get("resource", 0)) < 20 or d > float(h.get("melee_range", CombatConstants.MELEE)) + 60.0:
		return false
	h["resource"] = float(h.get("resource", 0)) - 20
	_set_skill_cd(h, 7, 8000)
	h["cast_anim"] = 1.0
	h["envenomed"] = true
	h["envenomed_end"] = t + 4500 + roundi(float(h.get("move_speed", 160)) * 12.0)
	eng._add_log(t, str(h.get("name", "")) + " Envenom!", "poison")
	return true


# 8: Smoke Bomb — 30 power, 12s CD, +45% evasion AoE, when HP<65%
static func _smoke_bomb(h: Dictionary, t: int, eng: Node) -> bool:
	if float(h.get("resource", 0)) < 30:
		return false
	if float(h.get("hp", 0)) / maxf(1.0, float(h.get("max_hp", 1))) > 0.65:
		return false
	if h.get("smoke_bomb_active", false):
		return false
	h["resource"] = float(h.get("resource", 0)) - 30
	_set_skill_cd(h, 8, 12000)
	h["cast_anim"] = 1.0
	h["smoke_bomb_active"] = true
	h["smoke_bomb_end"] = t + 3500 + roundi(float(h.get("evasion", 0.0)) * 8000.0)
	h["smoke_bomb_x"] = float(h.get("x", 0))
	eng._add_log(t, str(h.get("name", "")) + " Smoke Bomb!", "stealth")
	return true


# 9: Charge — 0 cost, 5.5s CD, rush + dmg=(baseDmg*1.5+def), range 100-350
static func _charge(h: Dictionary, t: int, eng: Node) -> bool:
	var e := _en(h, eng)
	var d := _dst(h, e)
	if d < 50 or d > 350:
		return false
	_set_skill_cd(h, 9, 5500)
	h["cast_anim"] = 1.0
	# Rush to enemy
	var dir := 1.0 if float(e.get("x", 0)) > float(h.get("x", 0)) else -1.0
	h["x"] = clampf(float(e.get("x", 0)) - dir * 45.0, float(CombatConstants.AX) + 25.0, float(CombatConstants.AX + CombatConstants.AW) - 25.0)
	h["y"] = float(e.get("y", h.get("y", CombatConstants.GY)))
	var dm: float = (float(h.get("base_dmg", 100)) * 1.5 + float(h.get("def", 0))) * _def_reduction(float(e.get("def", 0)))
	e["hp"] = float(e.get("hp", 0)) - dm
	h["tot_dmg"] = float(h.get("tot_dmg", 0)) + dm
	e["hurt_anim"] = 1.0
	eng._sp_float(float(e.get("x", 0)), float(e.get("y", 0)) - 60, str(roundi(dm)), "#cc4444")
	eng._add_log(t, str(h.get("name", "")) + " CHARGE " + str(roundi(dm)) + "!", "dmg")
	if not e.get("stealthed", false) and e.get("type", "") != "barbarian":
		e["stun_end"] = t + 250
	return true


# 10: War Cry — 0 cost, 10s CD, slow + weaken + DEF-based damage, no range limit
static func _war_cry(h: Dictionary, t: int, eng: Node) -> bool:
	var e := _en(h, eng)
	_set_skill_cd(h, 10, 10000)
	h["cast_anim"] = 1.0
	var sl: float = 0.18 + float(h.get("def", 0)) * 0.002
	e["slow"] = minf(0.4, sl)
	e["slow_end"] = t + 2000 + roundi(float(h.get("max_hp", 1500)) * 0.3)
	# DEF-based damage component
	var dm: float = float(h.get("def", 0)) * 1.5 * _def_reduction(float(e.get("def", 0)))
	e["hp"] = float(e.get("hp", 0)) - dm
	h["tot_dmg"] = float(h.get("tot_dmg", 0)) + dm
	e["hurt_anim"] = 1.0
	eng._sp_float(float(e.get("x", 0)), float(e.get("y", 0)) - 60, str(roundi(dm)), "#cc8844")
	eng._add_log(t, str(h.get("name", "")) + " WAR CRY " + str(roundi(dm)) + "!", "spell")
	return true


# 11: Frost Nova — 20 power, 7s CD, dmg+slow, freezes shocked targets
static func _frost_nova(h: Dictionary, t: int, eng: Node) -> bool:
	var e := _en(h, eng)
	var d := _dst(h, e)
	if float(h.get("resource", 0)) < 20 or d > 180:
		return false
	h["resource"] = float(h.get("resource", 0)) - 20
	_set_skill_cd(h, 11, 7000)
	h["cast_anim"] = 1.0
	if randf() < _eff_ev(e) * 0.4:
		eng._add_log(t, "Nova DODGED!", "miss")
		return true
	var dm: float = (80.0 + float(h.get("def", 0)) * 3.0) * (1.0 + float(h.get("spell_dmg_bonus", 0.0))) * _def_reduction(float(e.get("def", 0)))
	e["hp"] = float(e.get("hp", 0)) - dm
	h["tot_dmg"] = float(h.get("tot_dmg", 0)) + dm
	e["hurt_anim"] = 1.0
	e["slow"] = 0.3
	e["slow_end"] = t + 2000
	eng._sp_float(float(e.get("x", 0)), float(e.get("y", 0)) - 60, str(roundi(dm)), "#88ccff")
	eng._add_log(t, "Frost Nova " + str(roundi(dm)), "spell")
	# Freeze shocked targets
	if e.get("shocked", false) and t < int(e.get("shocked_end", 0)):
		if not e.get("stealthed", false) and e.get("type", "") != "barbarian":
			e["stun_end"] = t + 500
			eng._add_log(t, str(e.get("name", "")) + " FROZEN!", "stun")
	return true


# 12: Arcane Drain — 20 power, 8s CD, dmg + self heal, when HP<75%
static func _arcane_drain(h: Dictionary, t: int, eng: Node) -> bool:
	var e := _en(h, eng)
	var d := _dst(h, e)
	if float(h.get("resource", 0)) < 20 or d > float(h.get("spell_range", 400)):
		return false
	if float(h.get("hp", 0)) / maxf(1.0, float(h.get("max_hp", 1))) > 0.75:
		return false
	h["resource"] = float(h.get("resource", 0)) - 20
	_set_skill_cd(h, 12, 8000)
	h["cast_anim"] = 1.0
	if randf() < _eff_ev(e) * 0.5:
		eng._add_log(t, "Drain DODGED!", "miss")
		return true
	var dm: float = (60.0 + float(h.get("max_hp", 1500)) * 0.03) * (1.0 + float(h.get("spell_dmg_bonus", 0.0))) * _def_reduction(float(e.get("def", 0)))
	e["hp"] = float(e.get("hp", 0)) - dm
	h["tot_dmg"] = float(h.get("tot_dmg", 0)) + dm
	e["hurt_anim"] = 1.0
	var hl: float = 40.0 + float(h.get("spell_dmg_bonus", 0.0)) * 400.0
	h["hp"] = minf(float(h.get("max_hp", 1)), float(h.get("hp", 0)) + hl)
	h["tot_heal"] = float(h.get("tot_heal", 0)) + hl
	eng._sp_float(float(e.get("x", 0)), float(e.get("y", 0)) - 60, str(roundi(dm)), "#aa88ff")
	eng._sp_float(float(h.get("x", 0)), float(h.get("y", 0)) - 55, "+" + str(roundi(hl)), "#44aa66")
	eng._add_log(t, "Drain " + str(roundi(dm)) + " heal " + str(roundi(hl)), "spell")
	return true


# 13: Rupture — 15 power, 6s CD, detonates all bleeds, requires 2+ stacks
static func _rupture(h: Dictionary, t: int, eng: Node) -> bool:
	var e := _en(h, eng)
	if _bleed_count(e) < 2:
		return false
	if float(h.get("resource", 0)) < 15:
		return false
	h["resource"] = float(h.get("resource", 0)) - 15
	var stacks := _bleed_count(e)
	var per_stack: float = 30.0 + float(h.get("base_as", 0.5)) * 80.0
	var dm: float = float(stacks) * per_stack * _def_reduction(float(e.get("def", 0)))
	e["bleed_stacks"] = []
	e["hp"] = float(e.get("hp", 0)) - dm
	h["tot_dmg"] = float(h.get("tot_dmg", 0)) + dm
	e["hurt_anim"] = 1.0
	_set_skill_cd(h, 13, 6000)
	h["cast_anim"] = 1.0
	eng._sp_float(float(e.get("x", 0)), float(e.get("y", 0)) - 60, "x" + str(stacks) + " " + str(roundi(dm)), "#cc4444")
	eng._add_log(t, "Rupture x" + str(stacks) + " = " + str(roundi(dm)), "dmg")
	return true


# 14: Marked for Death — 15 power, 10s CD, vulnerable debuff
static func _marked_for_death(h: Dictionary, t: int, eng: Node) -> bool:
	var e := _en(h, eng)
	if e.get("vulnerable", false):
		return false
	if float(h.get("resource", 0)) < 15:
		return false
	h["resource"] = float(h.get("resource", 0)) - 15
	var amp: float = 0.08 + float(h.get("base_as", 0.5)) * 0.08
	e["vulnerable"] = true
	e["vulnerable_end"] = t + 3000
	e["vulnerable_amp"] = amp
	_set_skill_cd(h, 14, 10000)
	h["cast_anim"] = 1.0
	eng._sp_float(float(e.get("x", 0)), float(e.get("y", 0)) - 60, "VULNERABLE", "#ff8844")
	eng._add_log(t, str(e.get("name", "")) + " vulnerable +" + str(roundi(amp * 100.0)) + "%!", "spell")
	return true


# 15: Lacerate — 25 power, 8s CD, execute dmg scaling on missing HP, when target HP<70%
static func _lacerate(h: Dictionary, t: int, eng: Node) -> bool:
	var e := _en(h, eng)
	var d := _dst(h, e)
	if float(h.get("resource", 0)) < 25 or d > float(h.get("melee_range", CombatConstants.MELEE)) + 80.0:
		return false
	if float(e.get("hp", 0)) / maxf(1.0, float(e.get("max_hp", 1))) > 0.7:
		return false
	h["resource"] = float(h.get("resource", 0)) - 25
	_set_skill_cd(h, 15, 8000)
	h["cast_anim"] = 1.0
	if randf() < _eff_ev(e) * 0.3:
		eng._add_log(t, "Lacerate DODGED!", "miss")
		return true
	var missing_pct: float = 1.0 - float(e.get("hp", 0)) / maxf(1.0, float(e.get("max_hp", 1)))
	var dm: float = float(h.get("base_dmg", 100)) * (0.5 + float(h.get("evasion", 0.0)) * 2.0) * missing_pct * _def_reduction(float(e.get("def", 0)))
	e["hp"] = float(e.get("hp", 0)) - dm
	h["tot_dmg"] = float(h.get("tot_dmg", 0)) + dm
	e["hurt_anim"] = 1.0
	eng._sp_float(float(e.get("x", 0)), float(e.get("y", 0)) - 60, str(roundi(dm)), "#ff2222")
	eng._add_log(t, "Lacerate " + str(roundi(dm)) + " (" + str(roundi(missing_pct * 100.0)) + "%missing)", "dmg")
	_add_bleed(e, t)
	return true


# 16: Riposte — 20 power, 10s CD, counter-attack stance
static func _riposte(h: Dictionary, t: int, eng: Node) -> bool:
	var e := _en(h, eng)
	var d := _dst(h, e)
	if float(h.get("resource", 0)) < 20 or h.get("riposte_active", false) or d > 200:
		return false
	h["resource"] = float(h.get("resource", 0)) - 20
	_set_skill_cd(h, 16, 10000)
	h["cast_anim"] = 1.0
	h["riposte_active"] = true
	h["riposte_end"] = t + 2000
	h["riposte_dmg"] = float(h.get("base_dmg", 100)) * 0.8 + float(h.get("evasion", 0.0)) * 400.0
	eng._sp_float(float(h.get("x", 0)), float(h.get("y", 0)) - 60, "RIPOSTE", "#ccccff")
	eng._add_log(t, str(h.get("name", "")) + " Riposte stance!", "spell")
	return true


# 17: Battle Trance — 0 cost, 8s CD, converts 40% DEF to 60% DEF as DMG
static func _battle_trance(h: Dictionary, t: int, eng: Node) -> bool:
	var e := _en(h, eng)
	var d := _dst(h, e)
	if h.get("trance_active", false) or d > 250:
		return false
	_set_skill_cd(h, 17, 8000)
	h["cast_anim"] = 1.0
	var dmg_bonus: int = roundi(float(h.get("def", 0)) * 0.6)
	var def_loss: int = roundi(float(h.get("def", 0)) * 0.4)
	h["trance_active"] = true
	h["trance_end"] = t + 3000
	h["trance_dmg"] = float(dmg_bonus)
	h["trance_def_loss"] = float(def_loss)
	h["base_dmg"] = int(h.get("base_dmg", 0)) + dmg_bonus
	h["def"] = int(h.get("def", 0)) - def_loss
	eng._sp_float(float(h.get("x", 0)), float(h.get("y", 0)) - 60, "TRANCE +" + str(dmg_bonus), "#ff4444")
	eng._add_log(t, str(h.get("name", "")) + " Trance! +" + str(dmg_bonus) + " DMG", "spell")
	return true


# 18: Thorns — 0 cost, 12s CD, reflect 15%+def*0.5% dmg, when HP<60%
static func _thorns(h: Dictionary, t: int, eng: Node) -> bool:
	if h.get("thorns_active", false):
		return false
	if float(h.get("hp", 0)) / maxf(1.0, float(h.get("max_hp", 1))) > 0.6:
		return false
	_set_skill_cd(h, 18, 12000)
	h["cast_anim"] = 1.0
	var pct: float = 0.15 + float(h.get("def", 0)) * 0.005
	h["thorns_active"] = true
	h["thorns_end"] = t + 4000
	h["thorns_pct"] = minf(0.5, pct)
	eng._sp_float(float(h.get("x", 0)), float(h.get("y", 0)) - 60, "THORNS " + str(roundi(pct * 100.0)) + "%", "#44cc44")
	eng._add_log(t, str(h.get("name", "")) + " Thorns! " + str(roundi(pct * 100.0)) + "%", "spell")
	return true


# ============ ULTIMATES (0-7) ============

# 0: Thunderstorm — 25% HP threshold, 5 strikes every 450ms
static func _ult_thunderstorm(h: Dictionary, t: int, eng: Node) -> bool:
	var spells: Dictionary = h.get("spells", {})
	if spells.get("ultimate", {}).get("used", false):
		return false
	if float(h.get("hp", 0)) / maxf(1.0, float(h.get("max_hp", 1))) >= 0.25:
		return false
	spells.get("ultimate", {})["used"] = true
	h["ult_active"] = true
	h["ult_end"] = t + 2500
	h["ult_strikes"] = 5
	h["ult_strike_timer"] = 0
	h["cast_anim"] = 1.0
	eng._add_log(t, str(h.get("name", "")) + " THUNDERSTORM!", "ult")
	return true


# 1: Rain of Fire — 20% HP threshold, invulnerable + burn enemy
static func _ult_rain_of_fire(h: Dictionary, t: int, eng: Node) -> bool:
	var spells: Dictionary = h.get("spells", {})
	if spells.get("ultimate", {}).get("used", false):
		return false
	if float(h.get("hp", 0)) / maxf(1.0, float(h.get("max_hp", 1))) >= 0.20:
		return false
	spells.get("ultimate", {})["used"] = true
	h["ult_active"] = true
	h["ult_end"] = t + 1500 + roundi(float(h.get("base_as", 0.5)) * 1200.0)
	h["cast_anim"] = 1.0
	eng._add_log(t, str(h.get("name", "")) + " RAIN OF FIRE!", "ult")
	var e := _en(h, eng)
	e["burning"] = true
	e["burn_end"] = t + 3000
	e["burn_dmg"] = float(roundi(float(h.get("base_dmg", 100)) * 0.5))
	return true


# 2: Death Mark — 20% HP threshold, stores damage, detonates at end
static func _ult_death_mark(h: Dictionary, t: int, eng: Node) -> bool:
	var spells: Dictionary = h.get("spells", {})
	if spells.get("ultimate", {}).get("used", false):
		return false
	if float(h.get("hp", 0)) / maxf(1.0, float(h.get("max_hp", 1))) >= 0.20:
		return false
	spells.get("ultimate", {})["used"] = true
	h["cast_anim"] = 1.0
	h["combo"] = int(h.get("max_combo", 5))
	var e := _en(h, eng)
	e["death_mark_target"] = true
	e["death_mark_end"] = t + 3000 + roundi(float(h.get("evasion", 0.0)) * 5000.0)
	e["death_mark_dmg"] = 0.0
	eng._sp_float(float(e.get("x", 0)), float(e.get("y", 0)) - 70, "DEATH MARK", "#ff8800")
	eng._add_log(t, str(h.get("name", "")) + " DEATH MARK!", "ult")
	return true


# 3: Berserker Rage — 30% HP threshold, +AS/+DMG boost
static func _ult_berserker(h: Dictionary, t: int, eng: Node) -> bool:
	var spells: Dictionary = h.get("spells", {})
	if spells.get("ultimate", {}).get("used", false):
		return false
	if float(h.get("hp", 0)) / maxf(1.0, float(h.get("max_hp", 1))) >= 0.30:
		return false
	spells.get("ultimate", {})["used"] = true
	h["ult_active"] = true
	h["ult_end"] = t + 3000 + roundi(float(h.get("def", 0)) * 35.0)
	h["cast_anim"] = 1.0
	eng._sp_float(float(h.get("x", 0)), float(h.get("y", 0)) - 70, "BERSERKER", "#ff4444")
	eng._add_log(t, str(h.get("name", "")) + " BERSERKER RAGE!", "ult")
	return true


# 4: Arcane Overload — 25% HP threshold, burst dmg + burn + free spells 4s
static func _ult_arcane_overload(h: Dictionary, t: int, eng: Node) -> bool:
	var spells: Dictionary = h.get("spells", {})
	if spells.get("ultimate", {}).get("used", false):
		return false
	if float(h.get("hp", 0)) / maxf(1.0, float(h.get("max_hp", 1))) >= 0.25:
		return false
	spells.get("ultimate", {})["used"] = true
	h["cast_anim"] = 1.0
	var e := _en(h, eng)
	var dm: float = (200.0 + float(h.get("max_hp", 1500)) * 0.08) * (1.0 + float(h.get("spell_dmg_bonus", 0.0))) * _def_reduction(float(e.get("def", 0)))
	e["hp"] = float(e.get("hp", 0)) - dm
	h["tot_dmg"] = float(h.get("tot_dmg", 0)) + dm
	e["hurt_anim"] = 1.0
	e["burning"] = true
	e["burn_end"] = t + 3000
	e["burn_dmg"] = float(roundi(dm * 0.15))
	h["free_spells_active"] = true
	h["free_spells_end"] = t + 4000
	eng._sp_float(float(e.get("x", 0)), float(e.get("y", 0)) - 65, str(roundi(dm)), "#aa44ff")
	eng._sp_float(float(h.get("x", 0)), float(h.get("y", 0)) - 55, "FREE SPELLS", "#aa88ff")
	eng._add_log(t, str(h.get("name", "")) + " ARCANE OVERLOAD!", "ult")
	return true


# 5: Primal Fury — 20% HP threshold, extra attacks, poison on hit
static func _ult_primal_fury(h: Dictionary, t: int, eng: Node) -> bool:
	var spells: Dictionary = h.get("spells", {})
	if spells.get("ultimate", {}).get("used", false):
		return false
	if float(h.get("hp", 0)) / maxf(1.0, float(h.get("max_hp", 1))) >= 0.20:
		return false
	spells.get("ultimate", {})["used"] = true
	h["primal_active"] = true
	h["primal_end"] = t + 2000 + roundi(float(h.get("base_as", 0.5)) * 1500.0)
	h["cast_anim"] = 1.0
	eng._sp_float(float(h.get("x", 0)), float(h.get("y", 0)) - 70, "PRIMAL FURY", "#ff8844")
	eng._add_log(t, str(h.get("name", "")) + " PRIMAL FURY!", "ult")
	return true


# 6: Shadow Dance — 20% HP threshold, permanent stealth with rapid attacks
static func _ult_shadow_dance(h: Dictionary, t: int, eng: Node) -> bool:
	var spells: Dictionary = h.get("spells", {})
	if spells.get("ultimate", {}).get("used", false):
		return false
	if float(h.get("hp", 0)) / maxf(1.0, float(h.get("max_hp", 1))) >= 0.20:
		return false
	spells.get("ultimate", {})["used"] = true
	h["shadow_dance_active"] = true
	h["shadow_dance_end"] = t + 2500 + roundi(float(h.get("evasion", 0.0)) * 5000.0)
	h["stealthed"] = true
	h["stealth_end"] = h["shadow_dance_end"]
	h["cast_anim"] = 1.0
	eng._sp_float(float(h.get("x", 0)), float(h.get("y", 0)) - 70, "SHADOW DANCE", "#6644cc")
	eng._add_log(t, str(h.get("name", "")) + " SHADOW DANCE!", "ult")
	return true


# 7: Last Stand — 30% HP threshold, cannot die
static func _ult_last_stand(h: Dictionary, t: int, eng: Node) -> bool:
	var spells: Dictionary = h.get("spells", {})
	if spells.get("ultimate", {}).get("used", false):
		return false
	if float(h.get("hp", 0)) / maxf(1.0, float(h.get("max_hp", 1))) >= 0.30:
		return false
	spells.get("ultimate", {})["used"] = true
	h["last_stand_active"] = true
	h["last_stand_end"] = t + 1800 + roundi(float(h.get("def", 0)) * 18.0)
	h["cast_anim"] = 1.0
	eng._sp_float(float(h.get("x", 0)), float(h.get("y", 0)) - 70, "LAST STAND", "#ffcc22")
	eng._add_log(t, str(h.get("name", "")) + " LAST STAND!", "ult")
	return true
