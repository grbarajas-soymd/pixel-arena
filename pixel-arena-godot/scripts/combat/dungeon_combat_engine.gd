class_name DungeonCombatEngine
extends RefCounted
## Turn-based dungeon combat engine — port of JS dgCombat.js.
## Pure logic, no rendering. Emits signals for the UI layer.

# ── Signals ──────────────────────────────────────────────────────────
signal phase_changed(new_phase: String)
signal turn_started(actor: String, turn_num: int)
signal action_resolved(action: String, result: Dictionary)
signal damage_dealt(source_id: String, target_id: String, amount: int, info: Dictionary)
signal status_changed(target_id: String, statuses: Array)
signal combat_ended(result: String)  # "victory", "defeat", "fled"
signal telegraph_shown(special_id: String, telegraph: String, icon: String)
signal telegraph_cleared()
signal log_added(text: String, msg_type: String)
signal hp_changed()
signal companion_died()

# ── Constants ────────────────────────────────────────────────────────
const FATIGUE_TURN: int = 50
const CRIT_MULT: float = 1.75
const DEF_CAP: float = 0.8
const DEF_DIVISOR: float = 300.0
const POTION_HEAL_PCT: float = 0.35
const FROST_SLOW_MULT: float = 0.65

# ── Phase state ──────────────────────────────────────────────────────
var phase: String = "init"  # init, pick, player_anim, monster_anim, companion_anim, done
var turn_num: int = 0
var monster_round_count: int = 0
var current_actor: String = ""  # "hero", "monster", "companion"

# ── Combatants ───────────────────────────────────────────────────────
var hero: Dictionary = {}
var monster: Dictionary = {}
var companion: Dictionary = {}
var has_companion: bool = false

# ── AP Timeline ──────────────────────────────────────────────────────
var combatants: Array[Dictionary] = []  # [{id, ap, speed, alive}]

# ── Run reference ────────────────────────────────────────────────────
var run: Dictionary = {}

# ── Combat tracking ──────────────────────────────────────────────────
var dmg_dealt: float = 0.0
var dmg_taken: float = 0.0
var ult_used: bool = false
var auto_battle: bool = false

# ── Player buffs / status ────────────────────────────────────────────
var player_dmg_buff: float = 0.0
var player_dmg_buff_rounds: int = 0
var player_invuln_rounds: int = 0
var player_extra_attacks: int = 0
var player_stunned_by_monster: bool = false

var shield_hp: float = 0.0
var shield_rounds: int = 0
var stealth_active: bool = false
var bloodlust_active: bool = false
var riposte_ready: bool = false
var riposte_dmg: float = 0.0
var riposte_rounds: int = 0
var trance_active: bool = false
var trance_dmg_bonus: float = 0.0
var trance_def_loss: float = 0.0
var trance_rounds: int = 0
var thorns_active: bool = false
var thorns_pct: float = 0.0
var thorns_rounds: int = 0
var shadow_dance_rounds: int = 0
var last_stand_rounds: int = 0
var primal_fury_rounds: int = 0
var primal_extra_used: bool = false
var free_spells_rounds: int = 0
var death_mark_active: bool = false
var death_mark_dmg: float = 0.0
var death_mark_rounds: int = 0

# ── DoT state ────────────────────────────────────────────────────────
var poison_stacks: int = 0
var poison_turns_left: int = 0
var hero_poison_turns: int = 0
var burn_dmg: float = 0.0
var burn_turns_left: int = 0
var bleed_turns_left: int = 0

# ── Monster state ────────────────────────────────────────────────────
var monster_enraged: bool = false
var monster_enraged_rounds: int = 0
var monster_charging_special: Dictionary = {}  # {id, telegraph, icon}
var monster_specials: Array[Dictionary] = []  # [{id, cd, max_cd}]
var monster_heal_count: int = 0
var monster_vuln: bool = false
var monster_vuln_amp: float = 0.0
var monster_vuln_rounds: int = 0
var monster_frost_slow: bool = false
var monster_frost_rounds: int = 0
var monster_marked: bool = false
var monster_marked_rounds: int = 0
var monster_stunned: bool = false

# ── Companion state ──────────────────────────────────────────────────
var comp_alive: bool = false
var comp_hp: float = 0.0
var comp_max_hp: float = 200.0
var comp_dmg: float = 20.0
var comp_def: float = 5.0
var comp_as: float = 0.8
var comp_ability_cd: int = 0
var comp_ability_max_cd: int = 3
var comp_name: String = ""
var comp_data: Dictionary = {}

# ── Skills data cache ────────────────────────────────────────────────
var _skills_data: Array = []
var _ults_data: Array = []

# ── Skill cooldowns (turn-based) ────────────────────────────────────
var skill_cooldowns: Array[int] = [0, 0]
var _skill_max_cooldowns: Array[int] = [0, 0]


# ══════════════════════════════════════════════════════════════════════
#  INITIALIZATION
# ══════════════════════════════════════════════════════════════════════

func init_combat(run_data: Dictionary, monster_data: Dictionary, companion_data: Dictionary) -> void:
	run = run_data
	_load_skills_data()

	# ── Build hero ──
	hero = {
		"id": "hero",
		"name": run.get("hero_name", "Hero"),
		"class_key": run.get("hero_class", "barbarian"),
		"hp": float(run.get("hp", 4000)),
		"max_hp": float(run.get("max_hp", 4000)),
		"base_dmg": float(run.get("base_dmg", 100)) + float(run.get("bonus_dmg", 0)),
		"base_as": float(run.get("base_as", 0.8)) + float(run.get("bonus_as", 0.0)),
		"def": float(run.get("def", 40)) + float(run.get("bonus_def", 0)),
		"evasion": float(run.get("evasion", 0.0)),
		"mana": float(run.get("mana", 0)),
		"max_mana": float(run.get("max_mana", 100)),
		"mana_regen": float(run.get("mana_regen", 4)),
		"spell_dmg_bonus": float(run.get("spell_dmg_bonus", 0.0)),
		"crit": 0.05 + float(run.get("crit_chance", 0.0)),
		"lifesteal": float(run.get("lifesteal", 0.0)),
		"move_speed": float(run.get("move_speed", 100)),
		"skills": run.get("skills", []),  # skill indices from custom_char
		"ultimate": int(run.get("ultimate", 0)),
		"_thorns_reflect": float(run.get("thorns_reflect", 0.0)),
		"_hp_regen": int(run.get("hp_regen", 0)),
		"_dmg_reduction": float(run.get("dmg_reduction", 0.0)),
		"_fire_dmg": float(run.get("fire_dmg", 0.0)),
		"_ice_dmg": float(run.get("ice_dmg", 0.0)),
		"_lightning_dmg": float(run.get("lightning_dmg", 0.0)),
		"_special_affixes": run.get("special_affixes", []),
	}
	# Pull skills/ultimate from GameState if not in run
	var gs = Engine.get_singleton("GameState") if Engine.has_singleton("GameState") else null
	if hero["skills"] is Array and hero["skills"].is_empty():
		if gs:
			hero["skills"] = gs.custom_char.get("skills", [0, 1])
			hero["ultimate"] = int(gs.custom_char.get("ultimate", 0))

	# ── Build monster ──
	monster = {
		"id": "monster",
		"name": monster_data.get("name", "Monster"),
		"icon": monster_data.get("icon", ""),
		"hp": float(monster_data.get("hp", 500)),
		"max_hp": float(monster_data.get("max_hp", monster_data.get("hp", 500))),
		"base_dmg": float(monster_data.get("dmg", 50)),
		"def": float(monster_data.get("def", 10)),
		"evasion": float(monster_data.get("evasion", 0.0)),
		"tier": int(monster_data.get("tier", 1)),
		"type": monster_data.get("type", "humanoid"),
		"colors": monster_data.get("colors", {}),
	}
	# Monster specials
	monster_specials.clear()
	var specs: Array = monster_data.get("specials", [])
	for spec_id in specs:
		var mc: int = 4 if spec_id == "heavy_strike" else 5
		monster_specials.append({"id": str(spec_id), "cd": mc, "max_cd": mc})

	# ── Build companion ──
	has_companion = not companion_data.is_empty()
	if has_companion:
		comp_name = str(companion_data.get("template_name", companion_data.get("name", "Companion")))
		comp_data = companion_data
		comp_max_hp = float(companion_data.get("combat_hp", 200))
		comp_hp = comp_max_hp
		comp_dmg = float(companion_data.get("combat_dmg", 20))
		comp_def = float(companion_data.get("combat_def", 5))
		comp_as = float(companion_data.get("combat_as", 0.8))
		comp_alive = true
		comp_ability_cd = 0

	# ── AP Timeline ──
	var hero_speed := clampi(roundi((hero["base_as"] as float) * 100.0), 60, 200)
	var monster_speed := clampi(roundi((0.8 + float(monster["tier"] - 1) * 0.15) * 100.0), 60, 200)
	combatants.clear()
	combatants.append({"id": "hero", "ap": 0, "speed": hero_speed, "alive": true})
	combatants.append({"id": "monster", "ap": 0, "speed": monster_speed, "alive": true})
	if has_companion:
		var comp_speed := clampi(roundi(comp_as * 100.0), 60, 200)
		combatants.append({"id": "companion", "ap": 0, "speed": comp_speed, "alive": true})

	# Init skill cooldowns from tcd
	skill_cooldowns = [0, 0]
	_skill_max_cooldowns = [0, 0]
	var skills_arr: Array = hero.get("skills", [])
	for i in range(mini(skills_arr.size(), 2)):
		var si: int = int(skills_arr[i])
		if si >= 0 and si < _skills_data.size():
			_skill_max_cooldowns[i] = int(_skills_data[si].get("dungeon_tcd", _skills_data[si].get("tcd", 0)))

	# Start combat
	turn_num = 1
	phase = "pick"
	_advance_turn()


func _load_skills_data() -> void:
	if not _skills_data.is_empty():
		return
	var f := FileAccess.open("res://data/skills.json", FileAccess.READ)
	if not f:
		return
	var data = JSON.parse_string(f.get_as_text())
	f.close()
	if data is Dictionary:
		_skills_data = data.get("skills", [])
		_ults_data = data.get("ultimates", [])


# ══════════════════════════════════════════════════════════════════════
#  AP TIMELINE
# ══════════════════════════════════════════════════════════════════════

func _get_effective_speed(actor_id: String) -> int:
	for c in combatants:
		if c["id"] == actor_id:
			var base: int = int(c["speed"])
			var mult: float = 1.0
			if actor_id == "monster" and monster_frost_slow:
				mult *= FROST_SLOW_MULT
			return clampi(roundi(float(base) * mult), 30, 300)
	return 60


func calc_timeline_preview(count: int = 5) -> Array[String]:
	## Simulates AP forward without mutating state, returns next N actor IDs.
	var result: Array[String] = []
	# Snapshot current AP values
	var sim: Array[Dictionary] = []
	for c in combatants:
		sim.append({"id": str(c["id"]), "ap": int(c["ap"]), "alive": bool(c["alive"])})
	for _safety in range(count * 100):
		if result.size() >= count:
			break
		var best_id: String = ""
		var best_ap: int = -1
		for s in sim:
			if not s["alive"]:
				continue
			s["ap"] = int(s["ap"]) + _get_effective_speed(str(s["id"]))
			if int(s["ap"]) >= 100:
				var priority: int = 0
				if s["id"] == "hero":
					priority = 3
				elif s["id"] == "companion":
					priority = 2
				else:
					priority = 1
				if int(s["ap"]) > best_ap or (int(s["ap"]) == best_ap and priority > 0):
					best_ap = int(s["ap"])
					best_id = str(s["id"])
		if best_id != "":
			for s in sim:
				if s["id"] == best_id:
					s["ap"] = int(s["ap"]) - 100
					break
			result.append(best_id)
	return result


func _advance_turn() -> void:
	if phase == "done":
		return
	# Simulate AP accumulation
	for _safety in range(500):
		var best_id: String = ""
		var best_ap: int = -1
		for c in combatants:
			if not c["alive"]:
				continue
			c["ap"] = int(c["ap"]) + _get_effective_speed(str(c["id"]))
			if int(c["ap"]) >= 100:
				# Priority: hero > companion > monster
				var priority: int = 0
				if c["id"] == "hero":
					priority = 3
				elif c["id"] == "companion":
					priority = 2
				else:
					priority = 1
				if int(c["ap"]) > best_ap or (int(c["ap"]) == best_ap and priority > 0):
					best_ap = int(c["ap"])
					best_id = str(c["id"])
		if best_id != "":
			for c in combatants:
				if c["id"] == best_id:
					c["ap"] = int(c["ap"]) - 100
					break
			current_actor = best_id
			_start_turn(best_id)
			return


func _start_turn(actor_id: String) -> void:
	if actor_id == "hero":
		if player_stunned_by_monster:
			player_stunned_by_monster = false
			log_added.emit("Stunned! Turn skipped!", "bad")
			_advance_turn()
			return
		turn_num += 1
		phase = "pick"
		phase_changed.emit(phase)
		turn_started.emit("hero", turn_num)
		if auto_battle:
			_auto_pick_action()
	elif actor_id == "monster":
		phase = "monster_anim"
		phase_changed.emit(phase)
		_start_monster_turn()
	elif actor_id == "companion":
		phase = "companion_anim"
		phase_changed.emit(phase)
		_do_companion_turn()


# ══════════════════════════════════════════════════════════════════════
#  PLAYER ACTIONS
# ══════════════════════════════════════════════════════════════════════

func submit_action(action: String) -> void:
	if phase != "pick":
		return
	match action:
		"attack":
			_do_player_attack()
		"skill0":
			_do_player_skill(0)
		"skill1":
			_do_player_skill(1)
		"ultimate":
			_do_player_ultimate()
		"potion":
			_do_player_potion()
		"companion_ability":
			_apply_companion_ability()
		"flee":
			_do_player_flee()
		"_auto":
			auto_battle = not auto_battle
			if auto_battle and phase == "pick":
				_auto_pick_action()


func _do_player_attack() -> void:
	phase = "player_anim"
	phase_changed.emit(phase)
	var result := _calc_damage(hero, monster)
	_apply_player_hit(result)
	action_resolved.emit("attack", result)


func _apply_player_hit(result: Dictionary) -> void:
	var dmg: float = float(result.get("amount", 0))
	if result.get("evaded", false):
		damage_dealt.emit("hero", "monster", 0, {"evaded": true})
		log_added.emit("Attack evaded!", "info")
		_after_player_action()
		return

	# Apply vulnerability
	if monster_vuln:
		dmg *= (1.0 + monster_vuln_amp)

	# Shield on monster (monsters don't have shields, skip)
	monster["hp"] = float(monster["hp"]) - dmg
	dmg_dealt += dmg

	# Death mark tracking
	if death_mark_active:
		death_mark_dmg += dmg

	var info: Dictionary = {"crit": result.get("crit", false), "amount": roundi(dmg)}
	damage_dealt.emit("hero", "monster", roundi(dmg), info)
	log_added.emit("Attack deals " + str(roundi(dmg)) + " damage" + (" (CRIT!)" if info["crit"] else ""), "combat")

	# Riposte is for INCOMING attacks on hero, not outgoing
	# Thorns is for INCOMING attacks on hero, not outgoing

	# Lifesteal
	if hero.get("lifesteal", 0.0) > 0:
		var heal_amt := dmg * float(hero["lifesteal"])
		hero["hp"] = minf(float(hero["max_hp"]), float(hero["hp"]) + heal_amt)

	# Gear affix procs
	var affixes: Array = hero.get("_special_affixes", [])
	for affix in affixes:
		var affix_id: String = str(affix.get("id", ""))
		var affix_val: float = float(affix.get("value", 0))
		match affix_id:
			"chain_lightning_proc":
				if randf() < affix_val:
					var cl_dmg := 60.0 + float(hero["max_hp"]) * 0.02
					monster["hp"] = float(monster["hp"]) - cl_dmg
					dmg_dealt += cl_dmg
					log_added.emit("Chain Lightning proc! " + str(roundi(cl_dmg)) + " damage!", "buff")
			"double_strike":
				if randf() < affix_val:
					player_extra_attacks += 1
					log_added.emit("Double Strike!", "buff")
			"slow_on_hit":
				if randf() < affix_val:
					monster_frost_slow = true
					monster_frost_rounds = maxi(monster_frost_rounds, 1)
					log_added.emit("Chilling hit! Monster slowed.", "debuff")
			"dmg_aura":
				# Passive % damage boost already applied via player_dmg_buff or raw calc
				pass

	# Check monster death
	if float(monster["hp"]) <= 0:
		monster["hp"] = 0
		_end_combat("victory")
		return

	# Stealth breaks after attacking
	if stealth_active:
		stealth_active = false

	# Extra attacks (bloodlust, primal fury, extra attacks)
	if bloodlust_active:
		bloodlust_active = false
		log_added.emit("Bloodlust: extra attack!", "buff")
		var extra := _calc_damage(hero, monster)
		_apply_player_hit(extra)
		return
	if player_extra_attacks > 0:
		player_extra_attacks -= 1
		var extra := _calc_damage(hero, monster)
		_apply_player_hit(extra)
		return
	if primal_fury_rounds > 0 and not primal_extra_used:
		primal_extra_used = true
		# Apply poison on hit
		poison_stacks += 1
		poison_turns_left = maxi(poison_turns_left, 2)
		log_added.emit("Primal Fury: extra attack + poison!", "buff")
		var extra := _calc_damage(hero, monster)
		_apply_player_hit(extra)
		return

	hp_changed.emit()
	_after_player_action()


func _do_player_skill(slot_idx: int) -> void:
	var skills: Array = hero.get("skills", [])
	if slot_idx >= skills.size():
		log_added.emit("No skill in that slot!", "bad")
		return
	var skill_idx: int = int(skills[slot_idx])
	if skill_idx < 0 or skill_idx >= _skills_data.size():
		return
	var skill: Dictionary = _skills_data[skill_idx]
	var cost: int = int(skill.get("cost", 0))

	# Check cooldown
	if slot_idx < skill_cooldowns.size() and skill_cooldowns[slot_idx] > 0:
		log_added.emit("Skill on cooldown! " + str(skill_cooldowns[slot_idx]) + " turns left.", "bad")
		return

	# Check resource
	if cost > 0 and free_spells_rounds <= 0:
		if float(hero.get("mana", 0)) < float(cost):
			log_added.emit("Not enough resource!", "bad")
			return
		hero["mana"] = float(hero["mana"]) - float(cost)

	# Set cooldown
	if slot_idx < skill_cooldowns.size() and slot_idx < _skill_max_cooldowns.size():
		skill_cooldowns[slot_idx] = _skill_max_cooldowns[slot_idx]

	phase = "player_anim"
	phase_changed.emit(phase)
	_apply_skill_effect(skill_idx)
	action_resolved.emit("skill", {"skill_idx": skill_idx, "name": skill.get("name", "")})


func _do_player_ultimate() -> void:
	if ult_used:
		log_added.emit("Ultimate already used!", "bad")
		return
	ult_used = true
	phase = "player_anim"
	phase_changed.emit(phase)
	var ult_idx: int = int(hero.get("ultimate", 0))
	_apply_ult_effect(ult_idx)
	var ult_name: String = ""
	if ult_idx >= 0 and ult_idx < _ults_data.size():
		ult_name = _ults_data[ult_idx].get("name", "Ultimate")
	action_resolved.emit("ultimate", {"ult_idx": ult_idx, "name": ult_name})


func _do_player_potion() -> void:
	var potions: int = int(run.get("potions", 0))
	if potions <= 0:
		log_added.emit("No potions left!", "bad")
		return
	if float(hero["hp"]) >= float(hero["max_hp"]):
		log_added.emit("Already at full HP!", "bad")
		return

	run["potions"] = potions - 1
	var heal := float(hero["max_hp"]) * POTION_HEAL_PCT
	hero["hp"] = minf(float(hero["max_hp"]), float(hero["hp"]) + heal)
	log_added.emit("Potion heals " + str(roundi(heal)) + " HP!", "heal")
	hp_changed.emit()

	phase = "player_anim"
	phase_changed.emit(phase)
	action_resolved.emit("potion", {"heal": roundi(heal)})
	_after_player_action()


func _do_player_flee() -> void:
	phase = "player_anim"
	phase_changed.emit(phase)
	var chance: float = 0.5 + float(hero.get("evasion", 0.0))
	if randf() < chance:
		log_added.emit("Escaped!", "info")
		action_resolved.emit("flee", {"success": true})
		_end_combat("fled")
	else:
		log_added.emit("Failed to flee!", "bad")
		action_resolved.emit("flee", {"success": false})
		_after_player_action()


func _after_player_action() -> void:
	if phase == "done":
		return
	primal_extra_used = false
	_advance_turn()


# ══════════════════════════════════════════════════════════════════════
#  DAMAGE CALCULATION
# ══════════════════════════════════════════════════════════════════════

func _calc_damage(attacker: Dictionary, defender: Dictionary) -> Dictionary:
	var base: float = float(attacker.get("base_dmg", 100))
	var def_red: float = minf(float(defender.get("def", 0)) / DEF_DIVISOR, DEF_CAP)
	var raw: float = base * (1.0 - def_red)
	raw *= randf_range(0.85, 1.15)

	# Player damage buff
	if attacker.get("id") == "hero" and player_dmg_buff > 0:
		raw *= (1.0 + player_dmg_buff)

	# Trance bonus
	if attacker.get("id") == "hero" and trance_active:
		raw += trance_dmg_bonus

	# Stealth multiplier
	if attacker.get("id") == "hero" and stealth_active:
		raw *= 3.0

	# Monster enraged
	if attacker.get("id") == "monster" and monster_enraged:
		raw *= 1.5

	# Elemental damage bonus (highest element)
	if attacker.get("id") == "hero":
		var elem: float = maxf(maxf(float(attacker.get("_fire_dmg", 0.0)), float(attacker.get("_ice_dmg", 0.0))), float(attacker.get("_lightning_dmg", 0.0)))
		if elem > 0.0:
			raw *= (1.0 + elem)

	# Evasion check
	if randf() < float(defender.get("evasion", 0.0)):
		return {"amount": 0, "evaded": true, "crit": false}

	# Crit check
	var crit_chance: float = float(attacker.get("crit", 0.05))
	var is_crit := randf() < crit_chance
	if is_crit:
		raw *= CRIT_MULT

	return {"amount": roundi(raw), "evaded": false, "crit": is_crit}


func _calc_skill_damage(base_dmg: float, defender: Dictionary) -> Dictionary:
	var spell_bonus: float = float(hero.get("spell_dmg_bonus", 0.0))
	var raw: float = base_dmg * (1.0 + spell_bonus)
	var def_red: float = minf(float(defender.get("def", 0)) / DEF_DIVISOR, DEF_CAP)
	raw *= (1.0 - def_red)
	raw *= randf_range(0.90, 1.10)

	if player_dmg_buff > 0:
		raw *= (1.0 + player_dmg_buff)

	# Evasion
	if randf() < float(defender.get("evasion", 0.0)):
		return {"amount": 0, "evaded": true, "crit": false}

	# Crit
	var crit_chance: float = float(hero.get("crit", 0.05))
	var is_crit := randf() < crit_chance
	if is_crit:
		raw *= CRIT_MULT

	return {"amount": roundi(raw), "evaded": false, "crit": is_crit}


# ══════════════════════════════════════════════════════════════════════
#  SKILL EFFECTS (indices 0-18)
# ══════════════════════════════════════════════════════════════════════

func _apply_skill_effect(idx: int) -> void:
	match idx:
		0:  # Chain Lightning — stun + damage
			var bd := 140.0 + float(hero["max_hp"]) * 0.04
			var r := _calc_skill_damage(bd, monster)
			_deal_skill_damage(r, "Chain Lightning")
			if not r.get("evaded", false):
				monster_stunned = true
				log_added.emit("Monster stunned!", "debuff")
		1:  # Lightning Bolt — quick damage
			var bd := 90.0 + float(hero["max_hp"]) * 0.03
			var r := _calc_skill_damage(bd, monster)
			_deal_skill_damage(r, "Lightning Bolt")
		2:  # Static Shield
			var sh := 380.0 + float(hero["def"]) * 5.0
			sh *= (1.0 + float(hero.get("spell_dmg_bonus", 0.0)))
			shield_hp = sh
			shield_rounds = 2
			log_added.emit("Shield absorbs " + str(roundi(sh)) + " damage!", "buff")
			_after_player_action()
		3:  # Hunter's Mark — mark + slow
			monster_marked = true
			monster_marked_rounds = 2
			monster["evasion"] = maxf(0.0, float(monster.get("evasion", 0.0)) - 0.15)
			monster_frost_slow = true
			monster_frost_rounds = 2
			log_added.emit("Target marked! -15% evasion, slowed.", "debuff")
			_after_player_action()
		4:  # Bloodlust
			bloodlust_active = true
			hero["lifesteal"] = float(hero.get("lifesteal", 0.0)) + 0.15
			log_added.emit("Bloodlust! Extra attack + lifesteal.", "buff")
			_after_player_action()
		5:  # Summon Pet — spawn a Spirit Beast companion for 3 turns
			if comp_alive:
				log_added.emit("Companion already active!", "bad")
				# Refund resource
				if free_spells_rounds <= 0:
					hero["mana"] = minf(float(hero["max_mana"]), float(hero["mana"]) + 30.0)
				_after_player_action()
			else:
				comp_name = "Spirit Beast"
				comp_max_hp = float(hero["base_dmg"]) * 1.5
				comp_hp = comp_max_hp
				comp_dmg = float(hero["base_dmg"]) * 0.4
				comp_def = float(hero["def"]) * 0.3
				comp_as = float(hero["base_as"]) * 0.8
				comp_alive = true
				has_companion = true
				comp_data = {"type": "summoned", "turns_left": 3}
				comp_ability_cd = 99  # No special ability for summoned pets
				# Add to AP timeline if not already present
				var found := false
				for c in combatants:
					if c["id"] == "companion":
						c["alive"] = true
						c["ap"] = 0
						c["speed"] = clampi(roundi(comp_as * 100.0), 60, 200)
						found = true
						break
				if not found:
					var comp_speed := clampi(roundi(comp_as * 100.0), 60, 200)
					combatants.append({"id": "companion", "ap": 0, "speed": comp_speed, "alive": true})
				log_added.emit("Spirit Beast summoned for 3 turns!", "buff")
				_after_player_action()
		6:  # Shadow Step — stealth
			stealth_active = true
			log_added.emit("Entered stealth! Next attack deals 3x damage.", "buff")
			_after_player_action()
		7:  # Envenom — 50% DMG + 2 poison stacks for 3 turns
			var env_dmg := float(hero["base_dmg"]) * 0.5
			var env_r := _calc_skill_damage(env_dmg, monster)
			poison_stacks += 2
			poison_turns_left = maxi(poison_turns_left, 3)
			log_added.emit("Poison applied! " + str(poison_stacks) + " stacks for 3 turns.", "debuff")
			_deal_skill_damage(env_r, "Envenom")
		8:  # Smoke Bomb — evasion boost
			var bonus := 0.35 + minf(0.20, float(hero.get("evasion", 0.0)))
			hero["evasion"] = float(hero.get("evasion", 0.0)) + bonus
			hero["_smoke_bonus"] = bonus
			hero["_smoke_rounds"] = 2
			log_added.emit("Smoke bomb! +" + str(roundi(bonus * 100)) + "% evasion.", "buff")
			_after_player_action()
		9:  # Charge — heavy damage + stun
			var bd := float(hero["base_dmg"]) * 1.5 + float(hero["def"])
			var r := _calc_skill_damage(bd, monster)
			_deal_skill_damage(r, "Charge")
			if not r.get("evaded", false):
				monster_stunned = true
				log_added.emit("Monster stunned!", "debuff")
		10:  # War Cry — weaken enemy
			var reduction := 0.85 - float(hero["def"]) * 0.002
			monster["base_dmg"] = float(monster["base_dmg"]) * maxf(0.5, reduction)
			log_added.emit("War Cry! Monster weakened.", "debuff")
			_after_player_action()
		11:  # Frost Nova — damage + slow, freeze if shocked
			var bd := 80.0 + float(hero["def"]) * 3.0
			var r := _calc_skill_damage(bd, monster)
			_deal_skill_damage(r, "Frost Nova")
			if not r.get("evaded", false):
				monster_frost_slow = true
				monster_frost_rounds = 2
				if monster_stunned:
					# Frozen = extended stun
					log_added.emit("Monster frozen!", "debuff")
		12:  # Arcane Drain — damage + heal
			var bd := 60.0 + float(hero["max_hp"]) * 0.03
			var r := _calc_skill_damage(bd, monster)
			_deal_skill_damage(r, "Arcane Drain")
			if not r.get("evaded", false):
				var heal_val := 40.0 + float(hero.get("spell_dmg_bonus", 0.0)) * 400.0
				hero["hp"] = minf(float(hero["max_hp"]), float(hero["hp"]) + heal_val)
				log_added.emit("Drained " + str(roundi(heal_val)) + " HP!", "heal")
		13:  # Rupture — detonate bleed stacks
			if bleed_turns_left > 0:
				var bd := float(bleed_turns_left) * (30.0 + float(hero["base_as"]) * 80.0)
				var r := _calc_skill_damage(bd, monster)
				bleed_turns_left = 0
				_deal_skill_damage(r, "Rupture")
			else:
				log_added.emit("No bleeds to rupture!", "bad")
				_after_player_action()
		14:  # Marked for Death — stronger vulnerable
			monster_vuln = true
			monster_vuln_amp = 0.12 + float(hero["base_as"]) * 0.08
			monster_vuln_rounds = 2
			log_added.emit("Marked for Death! +" + str(roundi(monster_vuln_amp * 100)) + "% damage taken.", "debuff")
			_after_player_action()
		15:  # Lacerate — execute + bleed
			var missing_pct := 1.0 - float(monster["hp"]) / maxf(1.0, float(monster["max_hp"]))
			var bd := float(hero["base_dmg"]) * (0.5 + float(hero.get("evasion", 0.0)) * 2.0) * 0.3 * missing_pct
			bd = maxf(bd, float(hero["base_dmg"]) * 0.3)
			var r := _calc_skill_damage(bd, monster)
			_deal_skill_damage(r, "Lacerate")
			if not r.get("evaded", false):
				bleed_turns_left = maxi(bleed_turns_left, 2)
				log_added.emit("Target is bleeding!", "debuff")
		16:  # Riposte
			riposte_ready = true
			riposte_dmg = float(hero["base_dmg"]) * 0.8 + float(hero.get("evasion", 0.0)) * 400.0
			riposte_rounds = 1
			log_added.emit("Riposte ready! Will counter next attack.", "buff")
			_after_player_action()
		17:  # Battle Trance — convert DEF to DMG
			trance_active = true
			trance_dmg_bonus = float(hero["def"]) * 0.6
			trance_def_loss = float(hero["def"]) * 0.4
			trance_rounds = 2
			hero["def"] = float(hero["def"]) - trance_def_loss
			log_added.emit("Battle Trance! +" + str(roundi(trance_dmg_bonus)) + " DMG, -" + str(roundi(trance_def_loss)) + " DEF.", "buff")
			_after_player_action()
		18:  # Thorns
			thorns_active = true
			thorns_pct = minf(0.50, 0.15 + float(hero["def"]) * 0.005)
			thorns_rounds = 2
			log_added.emit("Thorns! Reflect " + str(roundi(thorns_pct * 100)) + "% damage.", "buff")
			_after_player_action()


func _deal_skill_damage(result: Dictionary, skill_name: String) -> void:
	var dmg: float = float(result.get("amount", 0))
	if result.get("evaded", false):
		damage_dealt.emit("hero", "monster", 0, {"evaded": true})
		log_added.emit(skill_name + " evaded!", "info")
		_after_player_action()
		return

	if monster_vuln:
		dmg *= (1.0 + monster_vuln_amp)

	monster["hp"] = float(monster["hp"]) - dmg
	dmg_dealt += dmg

	if death_mark_active:
		death_mark_dmg += dmg

	damage_dealt.emit("hero", "monster", roundi(dmg), {"crit": result.get("crit", false), "skill": true})
	log_added.emit(skill_name + " deals " + str(roundi(dmg)) + " damage!" + (" (CRIT!)" if result.get("crit", false) else ""), "combat")

	if float(monster["hp"]) <= 0:
		monster["hp"] = 0
		_end_combat("victory")
		return

	hp_changed.emit()
	_after_player_action()


# ══════════════════════════════════════════════════════════════════════
#  ULTIMATE EFFECTS (indices 0-7)
# ══════════════════════════════════════════════════════════════════════

func _apply_ult_effect(idx: int) -> void:
	match idx:
		0:  # Thunderstorm — 4 hits + lifesteal
			var total_dmg: float = 0.0
			for _i in range(4):
				var bd := 90.0 + float(hero["max_hp"]) * 0.04
				var r := _calc_skill_damage(bd, monster)
				if not r.get("evaded", false):
					var d := float(r["amount"])
					if monster_vuln:
						d *= (1.0 + monster_vuln_amp)
					monster["hp"] = float(monster["hp"]) - d
					total_dmg += d
					var heal_val := d * 0.35
					hero["hp"] = minf(float(hero["max_hp"]), float(hero["hp"]) + heal_val)
					if death_mark_active:
						death_mark_dmg += d
			dmg_dealt += total_dmg
			damage_dealt.emit("hero", "monster", roundi(total_dmg), {"ult": true})
			log_added.emit("Thunderstorm! " + str(roundi(total_dmg)) + " total damage + lifesteal!", "ult")
			if float(monster["hp"]) <= 0:
				monster["hp"] = 0
				_end_combat("victory")
				return
			hp_changed.emit()
			_after_player_action()

		1:  # Rain of Fire — invuln + extra attacks + burn
			player_invuln_rounds = 1
			player_extra_attacks = maxi(2, 1 + int(float(hero["base_as"]) / 1.25))
			var burn_val := float(hero["base_dmg"]) * 2.0
			burn_dmg = burn_val
			burn_turns_left = 3
			log_added.emit("Rain of Fire! Invulnerable + extra attacks + burn!", "ult")
			_after_player_action()

		2:  # Death Mark — track damage, detonate later
			death_mark_active = true
			death_mark_dmg = 0.0
			death_mark_rounds = 2 + int(float(hero.get("evasion", 0.0)) / 0.2)
			log_added.emit("Death Mark applied! Damage will detonate at 75%!", "ult")
			_after_player_action()

		3:  # Berserker Rage — damage buff
			var buff_pct := 0.25 + float(hero["def"]) * 0.003
			player_dmg_buff = buff_pct
			player_dmg_buff_rounds = 2 + int(float(hero["def"]) / 30.0)
			log_added.emit("Berserker Rage! +" + str(roundi(buff_pct * 100)) + "% damage for " + str(player_dmg_buff_rounds) + " rounds!", "ult")
			_after_player_action()

		4:  # Arcane Overload — burst + free spells + burn
			var bd := 200.0 + float(hero["max_hp"]) * 0.08
			var r := _calc_skill_damage(bd, monster)
			_deal_skill_damage(r, "Arcane Overload")
			free_spells_rounds = 2 + int(float(hero["max_hp"]) / 800.0)
			var burn_val := float(r.get("amount", 0)) * 0.15
			burn_dmg = burn_val
			burn_turns_left = 2
			log_added.emit("Free spells for " + str(free_spells_rounds) + " rounds!", "ult")

		5:  # Primal Fury — extra attacks + poison
			primal_fury_rounds = 3 + int(float(hero["base_as"]) / 0.5)
			log_added.emit("Primal Fury! Extra attacks + poison for " + str(primal_fury_rounds) + " rounds!", "ult")
			_after_player_action()

		6:  # Shadow Dance — persistent stealth
			shadow_dance_rounds = 3 + int(float(hero.get("evasion", 0.0)) / 0.15)
			stealth_active = true
			log_added.emit("Shadow Dance! Persistent stealth for " + str(shadow_dance_rounds) + " rounds!", "ult")
			_after_player_action()

		7:  # Last Stand — cannot die
			last_stand_rounds = 2 + int(float(hero["def"]) / 40.0)
			log_added.emit("Last Stand! Cannot die for " + str(last_stand_rounds) + " rounds!", "ult")
			_after_player_action()


# ══════════════════════════════════════════════════════════════════════
#  MONSTER TURN
# ══════════════════════════════════════════════════════════════════════

func _start_monster_turn() -> void:
	# Check stun
	if monster_stunned:
		monster_stunned = false
		log_added.emit("Monster is stunned! Turn skipped.", "debuff")
		_tick_round_durations()
		_advance_turn()
		return

	# Fatigue damage (turn 50+)
	if turn_num >= FATIGUE_TURN:
		var fatigue_pct := 0.02 + 0.01 * maxf(0.0, float(turn_num - FATIGUE_TURN))
		var fatigue_dmg := float(monster["max_hp"]) * fatigue_pct
		monster["hp"] = float(monster["hp"]) - fatigue_dmg
		log_added.emit("Fatigue! Monster takes " + str(roundi(fatigue_dmg)) + " damage.", "info")
		if float(monster["hp"]) <= 0:
			monster["hp"] = 0
			_end_combat("victory")
			return

	# Execute charged special
	if not monster_charging_special.is_empty():
		var spec_id: String = str(monster_charging_special.get("id", ""))
		monster_charging_special = {}
		telegraph_cleared.emit()
		_execute_monster_special(spec_id)
		return

	# Check for new special to telegraph
	for spec in monster_specials:
		if int(spec["cd"]) <= 0:
			spec["cd"] = int(spec["max_cd"])
			monster_charging_special = {"id": spec["id"], "telegraph": _get_telegraph_text(spec["id"]), "icon": spec["id"]}
			telegraph_shown.emit(spec["id"], monster_charging_special["telegraph"], spec["id"])
			log_added.emit("Monster is charging: " + str(monster_charging_special["telegraph"]), "warning")
			# Still attack this turn
			break

	# Normal attack
	_do_monster_attack()


func _do_monster_attack() -> void:
	var result := _calc_damage(monster, hero)
	var dmg: float = float(result.get("amount", 0))

	if result.get("evaded", false):
		damage_dealt.emit("monster", "hero", 0, {"evaded": true})
		log_added.emit("Monster attack evaded!", "info")
		_after_monster_action()
		return

	# Invulnerability
	if player_invuln_rounds > 0:
		damage_dealt.emit("monster", "hero", 0, {"blocked": true})
		log_added.emit("Invulnerable! No damage taken.", "buff")
		_after_monster_action()
		return

	# Gear affix damage reduction
	if float(hero.get("_dmg_reduction", 0.0)) > 0:
		dmg *= (1.0 - minf(float(hero["_dmg_reduction"]), 0.25))

	# Shield absorption
	if shield_hp > 0:
		if dmg <= shield_hp:
			shield_hp -= dmg
			damage_dealt.emit("monster", "hero", 0, {"shielded": true})
			log_added.emit("Shield absorbs " + str(roundi(dmg)) + " damage!", "buff")
			_apply_companion_splash(dmg)
			_after_monster_action()
			return
		else:
			dmg -= shield_hp
			log_added.emit("Shield broken!", "bad")
			shield_hp = 0
			shield_rounds = 0

	# Last Stand
	if last_stand_rounds > 0 and float(hero["hp"]) - dmg <= 0:
		hero["hp"] = 1
		dmg = 0
		log_added.emit("Last Stand prevents death!", "buff")

	hero["hp"] = maxf(0.0, float(hero["hp"]) - dmg)
	dmg_taken += dmg

	damage_dealt.emit("monster", "hero", roundi(dmg), {"crit": result.get("crit", false)})
	log_added.emit("Monster deals " + str(roundi(dmg)) + " damage!" + (" (CRIT!)" if result.get("crit", false) else ""), "combat")

	# Riposte counter
	if riposte_ready and dmg > 0:
		riposte_ready = false
		monster["hp"] = float(monster["hp"]) - riposte_dmg
		dmg_dealt += riposte_dmg
		damage_dealt.emit("hero", "monster", roundi(riposte_dmg), {"riposte": true})
		log_added.emit("Riposte! Counter for " + str(roundi(riposte_dmg)) + " damage!", "buff")
		if float(monster["hp"]) <= 0:
			monster["hp"] = 0
			_end_combat("victory")
			return

	# Thorns reflect
	if thorns_active and dmg > 0:
		var reflect := dmg * thorns_pct
		monster["hp"] = float(monster["hp"]) - reflect
		dmg_dealt += reflect
		log_added.emit("Thorns reflects " + str(roundi(reflect)) + " damage!", "buff")
		if float(monster["hp"]) <= 0:
			monster["hp"] = 0
			_end_combat("victory")
			return

	# Passive gear thorns reflect
	if float(hero.get("_thorns_reflect", 0.0)) > 0 and dmg > 0:
		var passive_reflect := dmg * float(hero["_thorns_reflect"])
		monster["hp"] = float(monster["hp"]) - passive_reflect
		dmg_dealt += passive_reflect
		if passive_reflect > 5:
			log_added.emit("Thorns reflects " + str(roundi(passive_reflect)) + "!", "buff")
		if float(monster["hp"]) <= 0:
			monster["hp"] = 0
			_end_combat("victory")
			return

	# Companion splash damage
	_apply_companion_splash(dmg)

	# Check hero death
	if float(hero["hp"]) <= 0:
		_end_combat("defeat")
		return

	hp_changed.emit()
	_after_monster_action()


func _apply_companion_splash(monster_dmg: float) -> void:
	if not comp_alive or not has_companion:
		return
	var splash := monster_dmg * 0.4 * (1.0 - minf(comp_def / DEF_DIVISOR, DEF_CAP))
	comp_hp -= splash
	if comp_hp <= 0:
		comp_hp = 0
		comp_alive = false
		for c in combatants:
			if c["id"] == "companion":
				c["alive"] = false
		log_added.emit(comp_name + " has fallen!", "bad")
		companion_died.emit()


func _after_monster_action() -> void:
	if phase == "done":
		return
	monster_round_count += 1
	_tick_round_durations()
	_advance_turn()


# ══════════════════════════════════════════════════════════════════════
#  MONSTER SPECIALS
# ══════════════════════════════════════════════════════════════════════

func _execute_monster_special(spec_id: String) -> void:
	match spec_id:
		"heavy_strike":
			var saved_dmg := float(monster["base_dmg"])
			monster["base_dmg"] = saved_dmg * 2.0
			log_added.emit("Monster uses Heavy Strike!", "warning")
			_do_monster_attack()
			monster["base_dmg"] = saved_dmg
			return

		"enrage":
			monster_enraged = true
			monster_enraged_rounds = 2
			log_added.emit("Monster enrages! +50% damage for 2 rounds.", "warning")
			_do_monster_attack()
			return

		"poison_spit":
			hero_poison_turns = 3
			log_added.emit("Poison spit! Hero poisoned for 3 turns.", "debuff")
			_after_monster_action()

		"heal":
			monster_heal_count += 1
			var heal_pct := 0.15 * pow(0.75, float(monster_heal_count - 1))
			var heal_val := float(monster["max_hp"]) * heal_pct
			monster["hp"] = minf(float(monster["max_hp"]), float(monster["hp"]) + heal_val)
			log_added.emit("Monster heals " + str(roundi(heal_val)) + " HP!", "warning")
			hp_changed.emit()
			_after_monster_action()

		"war_stomp":
			if randf() < float(hero.get("evasion", 0.0)):
				log_added.emit("War Stomp evaded!", "info")
			else:
				player_stunned_by_monster = true
				log_added.emit("War Stomp! Hero will be stunned next turn.", "debuff")
			_after_monster_action()


func _get_telegraph_text(spec_id: String) -> String:
	match spec_id:
		"heavy_strike": return "Winding up a devastating blow!"
		"enrage": return "Entering a rage!"
		"poison_spit": return "Preparing poison attack!"
		"heal": return "Gathering healing energy!"
		"war_stomp": return "Preparing to stomp!"
	return "Charging an attack!"


# ══════════════════════════════════════════════════════════════════════
#  COMPANION TURN
# ══════════════════════════════════════════════════════════════════════

func _do_companion_turn() -> void:
	if not comp_alive:
		_advance_turn()
		return

	# Auto-attack
	var def_red: float = minf(float(monster.get("def", 0)) / DEF_DIVISOR, DEF_CAP)
	var raw: float = comp_dmg * (1.0 - def_red) * randf_range(0.85, 1.15)
	monster["hp"] = float(monster["hp"]) - raw
	dmg_dealt += raw
	damage_dealt.emit("companion", "monster", roundi(raw), {})
	log_added.emit(comp_name + " attacks for " + str(roundi(raw)) + " damage.", "combat")

	if float(monster["hp"]) <= 0:
		monster["hp"] = 0
		_end_combat("victory")
		return

	# Ability check
	if comp_ability_cd <= 0:
		comp_ability_cd = comp_ability_max_cd
		_apply_companion_ability()
	else:
		comp_ability_cd -= 1

	hp_changed.emit()
	_advance_turn()


func _apply_companion_ability() -> void:
	var n := comp_name.to_lower()
	if "turtle" in n or "golem" in n or "crystal" in n:
		# Shield
		var sh := comp_max_hp * 0.3
		shield_hp += sh
		shield_rounds = maxi(shield_rounds, 2)
		log_added.emit(comp_name + " grants " + str(roundi(sh)) + " shield!", "buff")
	elif "mole" in n or "sprite" in n or "wisp" in n:
		# Heal
		var heal_val := float(hero["max_hp"]) * 0.1
		hero["hp"] = minf(float(hero["max_hp"]), float(hero["hp"]) + heal_val)
		log_added.emit(comp_name + " heals " + str(roundi(heal_val)) + " HP!", "heal")
	elif "fox" in n or "frog" in n or "elemental" in n:
		# Stun + damage
		var stun_dmg := comp_dmg * 1.5
		monster["hp"] = float(monster["hp"]) - stun_dmg
		monster_stunned = true
		log_added.emit(comp_name + " stuns the monster!", "debuff")
	elif "hawk" in n or "wolf" in n or "panther" in n or "raptor" in n or "bear" in n:
		# Big damage
		var big_dmg := comp_dmg * 3.0
		monster["hp"] = float(monster["hp"]) - big_dmg
		dmg_dealt += big_dmg
		log_added.emit(comp_name + " deals " + str(roundi(big_dmg)) + " damage!", "combat")
	else:
		# Default: moderate damage
		var mod_dmg := comp_dmg * 2.0
		monster["hp"] = float(monster["hp"]) - mod_dmg
		dmg_dealt += mod_dmg
		log_added.emit(comp_name + " uses ability for " + str(roundi(mod_dmg)) + " damage!", "combat")


# ══════════════════════════════════════════════════════════════════════
#  ROUND DURATION TICKING
# ══════════════════════════════════════════════════════════════════════

func _tick_round_durations() -> void:
	# Tick skill cooldowns
	for i in range(skill_cooldowns.size()):
		if skill_cooldowns[i] > 0:
			skill_cooldowns[i] -= 1

	# Mana regen (2x per monster round)
	hero["mana"] = minf(float(hero["max_mana"]), float(hero["mana"]) + float(hero["mana_regen"]) * 2.0)

	# Gear affix HP regen
	if int(hero.get("_hp_regen", 0)) > 0:
		var regen_val := float(hero["_hp_regen"])
		hero["hp"] = minf(float(hero["max_hp"]), float(hero["hp"]) + regen_val)

	# Player buff durations
	if player_dmg_buff_rounds > 0:
		player_dmg_buff_rounds -= 1
		if player_dmg_buff_rounds <= 0:
			player_dmg_buff = 0.0

	if player_invuln_rounds > 0:
		player_invuln_rounds -= 1

	if shield_rounds > 0:
		shield_rounds -= 1
		if shield_rounds <= 0:
			shield_hp = 0.0

	if trance_rounds > 0:
		trance_rounds -= 1
		if trance_rounds <= 0 and trance_active:
			hero["def"] = float(hero["def"]) + trance_def_loss
			trance_active = false
			trance_dmg_bonus = 0.0

	if thorns_rounds > 0:
		thorns_rounds -= 1
		if thorns_rounds <= 0:
			thorns_active = false

	if shadow_dance_rounds > 0:
		shadow_dance_rounds -= 1
		if shadow_dance_rounds <= 0:
			stealth_active = false
		else:
			stealth_active = true  # Re-apply stealth each round

	if last_stand_rounds > 0:
		last_stand_rounds -= 1
		if last_stand_rounds <= 0:
			# Heal 20% on expire
			var heal_val := float(hero["max_hp"]) * 0.2
			hero["hp"] = minf(float(hero["max_hp"]), float(hero["hp"]) + heal_val)
			log_added.emit("Last Stand expires. Healed " + str(roundi(heal_val)) + " HP.", "heal")

	if primal_fury_rounds > 0:
		primal_fury_rounds -= 1

	if free_spells_rounds > 0:
		free_spells_rounds -= 1

	if riposte_rounds > 0:
		riposte_rounds -= 1
		if riposte_rounds <= 0:
			riposte_ready = false

	# Smoke bomb expiry
	if hero.has("_smoke_rounds"):
		hero["_smoke_rounds"] = int(hero["_smoke_rounds"]) - 1
		if int(hero["_smoke_rounds"]) <= 0:
			hero["evasion"] = float(hero.get("evasion", 0.0)) - float(hero.get("_smoke_bonus", 0.0))
			hero.erase("_smoke_rounds")
			hero.erase("_smoke_bonus")

	# Death Mark check — detonate at 75% threshold
	if death_mark_active:
		death_mark_rounds -= 1
		if death_mark_rounds <= 0:
			var det_dmg := death_mark_dmg * 0.75
			monster["hp"] = float(monster["hp"]) - det_dmg
			dmg_dealt += det_dmg
			damage_dealt.emit("hero", "monster", roundi(det_dmg), {"death_mark": true})
			log_added.emit("Death Mark detonates for " + str(roundi(det_dmg)) + " damage!", "ult")
			death_mark_active = false
			death_mark_dmg = 0.0
			if float(monster["hp"]) <= 0:
				monster["hp"] = 0
				_end_combat("victory")
				return

	# DoT: Burn on monster
	if burn_turns_left > 0:
		monster["hp"] = float(monster["hp"]) - burn_dmg
		dmg_dealt += burn_dmg
		burn_turns_left -= 1
		log_added.emit("Burn deals " + str(roundi(burn_dmg)) + " damage.", "dot")
		if float(monster["hp"]) <= 0:
			monster["hp"] = 0
			_end_combat("victory")
			return

	# DoT: Poison on monster
	if poison_turns_left > 0:
		var poison_dmg := float(hero["base_dmg"]) * 0.3 * float(poison_stacks)
		monster["hp"] = float(monster["hp"]) - poison_dmg
		dmg_dealt += poison_dmg
		poison_turns_left -= 1
		if poison_turns_left <= 0:
			poison_stacks = 0
		log_added.emit("Poison deals " + str(roundi(poison_dmg)) + " damage.", "dot")
		if float(monster["hp"]) <= 0:
			monster["hp"] = 0
			_end_combat("victory")
			return

	# DoT: Bleed on monster
	if bleed_turns_left > 0:
		var bleed_dmg := float(hero["base_dmg"]) * 0.3
		monster["hp"] = float(monster["hp"]) - bleed_dmg
		dmg_dealt += bleed_dmg
		bleed_turns_left -= 1
		log_added.emit("Bleed deals " + str(roundi(bleed_dmg)) + " damage.", "dot")
		if float(monster["hp"]) <= 0:
			monster["hp"] = 0
			_end_combat("victory")
			return

	# DoT: Poison on hero (from monster)
	if hero_poison_turns > 0:
		var hero_poison_dmg := float(monster["base_dmg"]) * 0.25
		hero["hp"] = maxf(0.0, float(hero["hp"]) - hero_poison_dmg)
		dmg_taken += hero_poison_dmg
		hero_poison_turns -= 1
		log_added.emit("Poison deals " + str(roundi(hero_poison_dmg)) + " to hero.", "dot")
		if float(hero["hp"]) <= 0 and last_stand_rounds <= 0:
			_end_combat("defeat")
			return

	# Monster buff durations
	if monster_enraged_rounds > 0:
		monster_enraged_rounds -= 1
		if monster_enraged_rounds <= 0:
			monster_enraged = false

	if monster_vuln_rounds > 0:
		monster_vuln_rounds -= 1
		if monster_vuln_rounds <= 0:
			monster_vuln = false
			monster_vuln_amp = 0.0

	if monster_frost_rounds > 0:
		monster_frost_rounds -= 1
		if monster_frost_rounds <= 0:
			monster_frost_slow = false

	if monster_marked_rounds > 0:
		monster_marked_rounds -= 1
		if monster_marked_rounds <= 0:
			monster_marked = false

	# Summoned companion expiry
	if comp_alive and comp_data.get("type", "") == "summoned":
		comp_data["turns_left"] = int(comp_data.get("turns_left", 0)) - 1
		if int(comp_data["turns_left"]) <= 0:
			comp_alive = false
			for c in combatants:
				if c["id"] == "companion":
					c["alive"] = false
			log_added.emit("Spirit Beast fades away.", "info")
			companion_died.emit()

	# Tick monster special cooldowns
	for spec in monster_specials:
		if int(spec["cd"]) > 0:
			spec["cd"] = int(spec["cd"]) - 1

	hp_changed.emit()
	status_changed.emit("hero", _get_hero_statuses())
	status_changed.emit("monster", _get_monster_statuses())


# ══════════════════════════════════════════════════════════════════════
#  AUTO-BATTLE AI
# ══════════════════════════════════════════════════════════════════════

func _auto_pick_action() -> void:
	if phase != "pick":
		return
	var hp_pct := float(hero["hp"]) / maxf(1.0, float(hero["max_hp"]))
	var m_hp_pct := float(monster["hp"]) / maxf(1.0, float(monster["max_hp"]))
	var res := float(hero.get("mana", 0))

	# P1: Emergency potion at 30% HP
	if hp_pct < 0.30 and int(run.get("potions", 0)) > 0:
		submit_action("potion")
		return

	# P2: Defensive ult when HP low
	if not ult_used and hp_pct < 0.35:
		submit_action("ultimate")
		return

	# P3: Offensive ult when monster HP high and fight drags on
	if not ult_used and m_hp_pct > 0.5 and turn_num > 8:
		submit_action("ultimate")
		return

	# P4: Use skills smartly — skip utility if monster is nearly dead
	var skills: Array = hero.get("skills", [])
	for i in range(skills.size()):
		if not can_use_skill(i):
			continue
		var si: int = int(skills[i])
		if si >= 0 and si < _skills_data.size():
			var skill: Dictionary = _skills_data[si]
			var stype: String = str(skill.get("type", "damage"))
			if m_hp_pct < 0.2 and stype != "damage":
				continue
			submit_action("skill" + str(i))
			return

	# P5: Potion at 50% HP (non-emergency)
	if hp_pct < 0.50 and int(run.get("potions", 0)) > 0:
		submit_action("potion")
		return

	# P6: Basic attack
	submit_action("attack")


# ══════════════════════════════════════════════════════════════════════
#  STATUS DISPLAY HELPERS
# ══════════════════════════════════════════════════════════════════════

func _get_hero_statuses() -> Array:
	var s: Array = []
	if shield_hp > 0:
		s.append({"id": "shield", "name": "Shield", "color": "#44dddd", "turns": shield_rounds})
	if stealth_active:
		s.append({"id": "stealth", "name": "Stealth", "color": "#66aaff", "turns": shadow_dance_rounds})
	if bloodlust_active:
		s.append({"id": "bloodlust", "name": "Bloodlust", "color": "#ff6644", "turns": 0})
	if riposte_ready:
		s.append({"id": "riposte", "name": "Riposte", "color": "#ffaa44", "turns": riposte_rounds})
	if trance_active:
		s.append({"id": "trance", "name": "Trance", "color": "#ff4444", "turns": trance_rounds})
	if thorns_active:
		s.append({"id": "thorns", "name": "Thorns", "color": "#44aa44", "turns": thorns_rounds})
	if shadow_dance_rounds > 0:
		s.append({"id": "shadow_dance", "name": "Shadow Dance", "color": "#8866ff", "turns": shadow_dance_rounds})
	if last_stand_rounds > 0:
		s.append({"id": "last_stand", "name": "Last Stand", "color": "#ffdd44", "turns": last_stand_rounds})
	if primal_fury_rounds > 0:
		s.append({"id": "primal_fury", "name": "Primal Fury", "color": "#ff8844", "turns": primal_fury_rounds})
	if free_spells_rounds > 0:
		s.append({"id": "free_spells", "name": "Free Spells", "color": "#44ddff", "turns": free_spells_rounds})
	if player_invuln_rounds > 0:
		s.append({"id": "invuln", "name": "Invulnerable", "color": "#ffffff", "turns": player_invuln_rounds})
	if player_dmg_buff > 0:
		s.append({"id": "dmg_buff", "name": "Damage+", "color": "#ff6644", "turns": player_dmg_buff_rounds})
	if hero_poison_turns > 0:
		s.append({"id": "poisoned", "name": "Poisoned", "color": "#66aa44", "turns": hero_poison_turns})
	if player_stunned_by_monster:
		s.append({"id": "stunned", "name": "Stunned", "color": "#ffcc44", "turns": 1})
	return s


func _get_monster_statuses() -> Array:
	var s: Array = []
	if monster_stunned:
		s.append({"id": "stunned", "name": "Stunned", "color": "#ffcc44", "turns": 1})
	if monster_enraged:
		s.append({"id": "enraged", "name": "Enraged", "color": "#ff4444", "turns": monster_enraged_rounds})
	if monster_vuln:
		s.append({"id": "vulnerable", "name": "Vulnerable", "color": "#ff6644", "turns": monster_vuln_rounds})
	if monster_frost_slow:
		s.append({"id": "slowed", "name": "Slowed", "color": "#44aaff", "turns": monster_frost_rounds})
	if monster_marked:
		s.append({"id": "marked", "name": "Marked", "color": "#ffaa22", "turns": monster_marked_rounds})
	if poison_turns_left > 0:
		s.append({"id": "poison", "name": "Poison x" + str(poison_stacks), "color": "#66aa44", "turns": poison_turns_left})
	if burn_turns_left > 0:
		s.append({"id": "burn", "name": "Burning", "color": "#ff8844", "turns": burn_turns_left})
	if bleed_turns_left > 0:
		s.append({"id": "bleed", "name": "Bleeding", "color": "#cc4444", "turns": bleed_turns_left})
	if death_mark_active:
		s.append({"id": "death_mark", "name": "Death Mark", "color": "#8844ff", "turns": death_mark_rounds})
	if not monster_charging_special.is_empty():
		s.append({"id": "charging", "name": "Charging!", "color": "#ffcc00", "turns": 1})
	return s


# ══════════════════════════════════════════════════════════════════════
#  END COMBAT
# ══════════════════════════════════════════════════════════════════════

func _end_combat(result: String) -> void:
	if phase == "done":
		return
	phase = "done"
	phase_changed.emit(phase)

	# Gear affix on-kill procs
	if result == "victory":
		var affixes: Array = hero.get("_special_affixes", [])
		for affix in affixes:
			var affix_id: String = str(affix.get("id", ""))
			var affix_val: float = float(affix.get("value", 0))
			match affix_id:
				"life_on_kill":
					var heal_val := float(hero["max_hp"]) * affix_val
					hero["hp"] = minf(float(hero["max_hp"]), float(hero["hp"]) + heal_val)
					log_added.emit("Executioner heals " + str(roundi(heal_val)) + " HP!", "heal")

	# Write back to run
	run["hp"] = maxi(0, roundi(float(hero["hp"])))
	run["mana"] = roundi(float(hero.get("mana", 0)))
	run["last_combat_stats"] = {
		"turns": turn_num,
		"dmg_dealt": roundi(dmg_dealt),
		"dmg_taken": roundi(dmg_taken),
		"hp_before": run.get("last_combat_stats", {}).get("hp_before", 0),
		"monster_name": monster.get("name", "Monster"),
		"monster_icon": monster.get("icon", ""),
	}

	combat_ended.emit(result)


# ══════════════════════════════════════════════════════════════════════
#  QUERY HELPERS (for UI)
# ══════════════════════════════════════════════════════════════════════

func get_hero_hp_pct() -> float:
	return float(hero["hp"]) / maxf(1.0, float(hero["max_hp"]))

func get_monster_hp_pct() -> float:
	return float(monster["hp"]) / maxf(1.0, float(monster["max_hp"]))

func get_comp_hp_pct() -> float:
	if not has_companion:
		return 0.0
	return comp_hp / maxf(1.0, comp_max_hp)

func get_mana_pct() -> float:
	return float(hero.get("mana", 0)) / maxf(1.0, float(hero.get("max_mana", 100)))

func get_skill_info(slot_idx: int) -> Dictionary:
	var skills: Array = hero.get("skills", [])
	if slot_idx >= skills.size():
		return {}
	var si: int = int(skills[slot_idx])
	if si < 0 or si >= _skills_data.size():
		return {}
	return _skills_data[si]

func get_ult_info() -> Dictionary:
	var ui: int = int(hero.get("ultimate", 0))
	if ui < 0 or ui >= _ults_data.size():
		return {}
	return _ults_data[ui]

func can_use_skill(slot_idx: int) -> bool:
	var info := get_skill_info(slot_idx)
	if info.is_empty():
		return false
	# Check cooldown
	if slot_idx < skill_cooldowns.size() and skill_cooldowns[slot_idx] > 0:
		return false
	var cost: int = int(info.get("cost", 0))
	if free_spells_rounds > 0:
		return true
	return cost <= 0 or float(hero.get("mana", 0)) >= float(cost)


func get_skill_cooldown(slot_idx: int) -> int:
	if slot_idx < skill_cooldowns.size():
		return skill_cooldowns[slot_idx]
	return 0


func get_effective_speed_for(actor_id: String) -> int:
	return _get_effective_speed(actor_id)


func get_base_speed_for(actor_id: String) -> int:
	for c in combatants:
		if c["id"] == actor_id:
			return int(c["speed"])
	return 60

func can_use_potion() -> bool:
	return int(run.get("potions", 0)) > 0 and float(hero["hp"]) < float(hero["max_hp"])

func can_use_ultimate() -> bool:
	return not ult_used
