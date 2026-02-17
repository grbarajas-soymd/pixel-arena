extends Node
## Real-time combat engine — 1:1 port of src/combat/engine.js + movement.js + buffs.js
## Runs at 50ms tick intervals using _process accumulator.
class_name CombatEngine

signal combat_started
signal combat_ended(winner: Dictionary)
signal damage_dealt(attacker: Dictionary, target: Dictionary, amount: float)
signal spell_cast(caster: Dictionary, spell_name: String)
signal projectile_spawned(proj: Dictionary)
signal float_spawned(x: float, y: float, text: String, color: String)
signal log_added(time_sec: float, text: String, log_type: String)

# Combat state
var h1: Dictionary = {}
var h2: Dictionary = {}
var bt: int = 0  # battle time in ms
var over: bool = false
var logs: Array[Dictionary] = []
var projectiles: Array[Dictionary] = []
var speed_multiplier: int = 1

var _tick_accumulator: float = 0.0
const TICK_SEC: float = 0.05  # 50ms

var _show_win_fn: Callable
var _classes: Dictionary = {}


func _ready() -> void:
	set_process(false)
	var file := FileAccess.open("res://data/classes.json", FileAccess.READ)
	if file:
		_classes = JSON.parse_string(file.get_as_text())
		file.close()


func setup(hero1: Dictionary, hero2: Dictionary) -> void:
	h1 = hero1
	h2 = hero2
	bt = 0
	over = false
	logs.clear()
	projectiles.clear()
	_tick_accumulator = 0.0


func start() -> void:
	combat_started.emit()
	set_process(true)


func stop() -> void:
	set_process(false)


func _process(delta: float) -> void:
	if over:
		return
	_tick_accumulator += delta
	var ticks := 0
	while _tick_accumulator >= TICK_SEC and not over:
		for _i in range(speed_multiplier):
			if over:
				break
			_tick()
		_tick_accumulator -= TICK_SEC
		ticks += 1
		if ticks > 4:
			_tick_accumulator = 0.0
			break
	_update_projectiles(delta)


# ============ HELPERS ============

func en(h: Dictionary) -> Dictionary:
	return h2 if h == h1 else h1


func _add_log(ms: int, txt: String, typ: String) -> void:
	logs.append({"t": snappedf(float(ms) / 1000.0, 0.1), "txt": txt, "typ": typ})
	log_added.emit(float(ms) / 1000.0, txt, typ)


func _sp_float(x: float, y: float, text: String, color: String) -> void:
	float_spawned.emit(x, y, text, color)


func _cls(key: String) -> Dictionary:
	return _classes.get(key, {})


# ============ MAIN TICK ============
# Port of engine.js tick() lines 140-211

func _tick() -> void:
	if over:
		return
	var dt: int = CombatConstants.TK
	bt += dt
	var dts: float = float(dt) / 1000.0

	for h in [h1, h2]:
		_tick_cooldowns(h, dt)
		_proc_expiry(h, bt)
		_proc_resources(h, dt)

		if h.get("type", "") == "wizard":
			_proc_wiz_ult(h, bt, dt)
		if h.get("type", "") == "custom" and h.get("custom_ult_id") != null:
			_proc_custom_ult(h, bt, dt)

		CombatMath.proc_bleed(h, bt, dt)
		if _check_death(h, bt):
			return

		_move_ai(h, dt)
		var fol: Dictionary = h.get("follower", {})
		if not fol.is_empty() and fol.get("alive", false):
			_move_follower(fol, h, en(h), dt)

		_spell_ai(h, bt)

		var as_val: float = CombatMath.eff_as(h, bt)
		var interval_ms: float = 1000.0 / as_val
		h["atk_cd"] = float(h.get("atk_cd", 0)) - float(dt)
		if float(h.get("atk_cd", 0)) <= 0:
			var hit: bool = _do_attack(h, bt)
			h["atk_cd"] = interval_ms if hit else 80.0
			if not over and _check_death(en(h), bt):
				return

	# Arena follower tick
	_tick_arena_followers(dts, dt)

	# Animation timers
	for h in [h1, h2]:
		h["bob_phase"] = float(h.get("bob_phase", 0)) + dts * 3.0
		if float(h.get("attack_anim", 0)) > 0:
			h["attack_anim"] = maxf(0.0, float(h.get("attack_anim", 0)) - dts * 5.0)
		if float(h.get("hurt_anim", 0)) > 0:
			h["hurt_anim"] = maxf(0.0, float(h.get("hurt_anim", 0)) - dts * 4.0)
		if float(h.get("cast_anim", 0)) > 0:
			h["cast_anim"] = maxf(0.0, float(h.get("cast_anim", 0)) - dts * 3.0)
		var fol2: Dictionary = h.get("follower", {})
		if not fol2.is_empty() and fol2.get("alive", false):
			fol2["bob_phase"] = float(fol2.get("bob_phase", 0)) + dts * 4.0
			if float(fol2.get("hurt_anim", 0)) > 0:
				fol2["hurt_anim"] = maxf(0.0, float(fol2.get("hurt_anim", 0)) - dts * 4.0)


# ============ COOLDOWNS & RESOURCES ============
# Port of buffs.js tickCD (line 94), procRes (line 93)

func _tick_cooldowns(h: Dictionary, dt: int) -> void:
	var spells: Dictionary = h.get("spells", {})
	for k in spells:
		if float(spells[k].get("cd", 0)) > 0:
			spells[k]["cd"] = maxf(0.0, float(spells[k]["cd"]) - float(dt))


func _proc_resources(h: Dictionary, dt: int) -> void:
	var hero_type: String = h.get("type", "")
	if hero_type == "wizard":
		h["mana"] = minf(float(h.get("max_mana", 0)), float(h.get("mana", 0)) + float(h.get("mana_regen", 0)) * (float(dt) / 1000.0))
		if int(h.get("charge", 0)) > 0:
			h["charge_decay_timer"] = int(h.get("charge_decay_timer", 0)) + dt
			if int(h.get("charge_decay_timer", 0)) >= 4000:
				h["charge_decay_timer"] = 0
				h["charge"] = maxi(0, int(h.get("charge", 0)) - 1)
	if hero_type == "assassin":
		h["energy"] = minf(float(h.get("max_energy", 0)), float(h.get("energy", 0)) + float(h.get("energy_regen", 0)) * (float(dt) / 1000.0))


# ============ BUFF EXPIRY ============
# Port of buffs.js procExp() lines 83-91

func _proc_expiry(h: Dictionary, t: int) -> void:
	var hero_type: String = h.get("type", "")

	if hero_type == "ranger":
		if h.get("bl_active", false) and t >= int(h.get("bl_end", 0)):
			h["bl_active"] = false
			var hl: float = float(h.get("bl_dmg", 0)) * 0.35
			h["hp"] = minf(float(h.get("max_hp", 1)), float(h.get("hp", 0)) + hl)
			h["tot_heal"] = float(h.get("tot_heal", 0)) + hl
			_sp_float(float(h.get("x", 0)), float(h.get("y", CombatConstants.GY)) - 60.0, "+" + str(roundi(hl)), "#44aa66")
			_add_log(t, "Bloodlust heal " + str(roundi(hl)), "heal")
		if h.get("ult_active", false) and t >= int(h.get("ult_end", 0)):
			h["ult_active"] = false

	elif hero_type == "wizard":
		if h.get("shield_active", false) and t >= int(h.get("shield_end", 0)):
			h["shield_active"] = false
		if h.get("ult_active", false) and t >= int(h.get("ult_end", 0)):
			h["ult_active"] = false

	elif hero_type == "assassin":
		if h.get("stealthed", false) and t >= int(h.get("stealth_end", 0)):
			h["stealthed"] = false
		if h.get("envenomed", false) and t >= int(h.get("envenomed_end", 0)):
			h["envenomed"] = false
		if h.get("smoke_bomb_active", false) and t >= int(h.get("smoke_bomb_end", 0)):
			h["smoke_bomb_active"] = false
		if int(h.get("combo", 0)) > 0 and float(h.get("atk_cd", 0)) > 200:
			h["combo"] = maxi(0, int(h.get("combo", 0)) - roundi(0.5 * (float(CombatConstants.TK) / 1000.0)))

	elif hero_type == "barbarian":
		if h.get("ult_active", false) and t >= int(h.get("ult_end", 0)):
			h["ult_active"] = false

	elif hero_type == "custom":
		if h.get("bl_active", false) and t >= int(h.get("bl_end", 0)):
			h["bl_active"] = false
			var hl2: float = float(h.get("bl_dmg", 0)) * 0.35
			h["hp"] = minf(float(h.get("max_hp", 1)), float(h.get("hp", 0)) + hl2)
			h["tot_heal"] = float(h.get("tot_heal", 0)) + hl2
			_sp_float(float(h.get("x", 0)), float(h.get("y", CombatConstants.GY)) - 60.0, "+" + str(roundi(hl2)), "#44aa66")
		if h.get("shield_active", false) and t >= int(h.get("shield_end", 0)):
			h["shield_active"] = false
		if h.get("ult_active", false) and t >= int(h.get("ult_end", 0)):
			h["ult_active"] = false
		if h.get("stealthed", false) and t >= int(h.get("stealth_end", 0)):
			h["stealthed"] = false
		if h.get("envenomed", false) and t >= int(h.get("envenomed_end", 0)):
			h["envenomed"] = false
		if h.get("smoke_bomb_active", false) and t >= int(h.get("smoke_bomb_end", 0)):
			h["smoke_bomb_active"] = false
		if h.get("trance_active", false) and t >= int(h.get("trance_end", 0)):
			h["trance_active"] = false
			h["base_dmg"] = float(h.get("base_dmg", 0)) - float(h.get("trance_dmg", 0))
			h["def"] = float(h.get("def", 0)) + float(h.get("trance_def_loss", 0))
		if h.get("riposte_active", false) and t >= int(h.get("riposte_end", 0)):
			h["riposte_active"] = false
		if h.get("thorns_active", false) and t >= int(h.get("thorns_end", 0)):
			h["thorns_active"] = false
		if h.get("shadow_dance_active", false) and t >= int(h.get("shadow_dance_end", 0)):
			h["shadow_dance_active"] = false
			h["stealthed"] = false
		if h.get("last_stand_active", false) and t >= int(h.get("last_stand_end", 0)):
			h["last_stand_active"] = false
			var ls_heal := roundi(float(h.get("max_hp", 1)) * 0.2)
			h["hp"] = minf(float(h.get("max_hp", 1)), float(h.get("hp", 0)) + float(ls_heal))
			h["tot_heal"] = float(h.get("tot_heal", 0)) + float(ls_heal)
			_sp_float(float(h.get("x", 0)), float(h.get("y", CombatConstants.GY)) - 60.0, "+" + str(ls_heal), "#44aa66")
		if h.get("primal_active", false) and t >= int(h.get("primal_end", 0)):
			h["primal_active"] = false
		if h.get("free_spells_active", false) and t >= int(h.get("free_spells_end", 0)):
			h["free_spells_active"] = false

	# Death mark detonation (any type)
	if h.get("death_mark_target", false) and t >= int(h.get("death_mark_end", 0)):
		h["death_mark_target"] = false
		var dmg_pct := float(_cls("assassin").get("death_mark_dmg", 0.85))
		var burst: float = float(h.get("death_mark_dmg", 0)) * dmg_pct
		h["hp"] = float(h.get("hp", 0)) - burst
		h["hurt_anim"] = 1.0
		_sp_float(float(h.get("x", 0)), float(h.get("y", CombatConstants.GY)) - 70.0, "DEATH " + str(roundi(burst)), "#ff4400")
		_add_log(t, "Death Mark pops " + str(roundi(burst)) + "!", "ult")

	# General status expiry
	if float(h.get("slow", 0)) > 0 and t >= int(h.get("slow_end", 0)):
		h["slow"] = 0.0
	if h.get("shocked", false) and t >= int(h.get("shocked_end", 0)):
		h["shocked"] = false
	if h.get("vulnerable", false) and t >= int(h.get("vulnerable_end", 0)):
		h["vulnerable"] = false
		h["vulnerable_amp"] = 0.0
	if h.get("burning", false) and t >= int(h.get("burn_end", 0)):
		h["burning"] = false


# ============ WIZARD ULTIMATE PROC ============
# Port of buffs.js procWizUlt() line 45

func _proc_wiz_ult(w: Dictionary, t: int, dt: int) -> void:
	if not w.get("ult_active", false) or int(w.get("ult_strikes", 0)) <= 0:
		return
	w["ult_strike_timer"] = int(w.get("ult_strike_timer", 0)) + dt
	if int(w.get("ult_strike_timer", 0)) >= 450:
		w["ult_strike_timer"] = 0
		w["ult_strikes"] = int(w.get("ult_strikes", 0)) - 1
		var e: Dictionary = en(w)
		var c: Dictionary = _cls("wizard")
		var dm: float = float(c.get("ult_dmg", 200)) * CombatMath.get_sdm(w) * (1.0 - minf(float(e.get("def", 0)) / 300.0, 0.8))
		e["hp"] = float(e.get("hp", 0)) - dm
		w["tot_dmg"] = float(w.get("tot_dmg", 0)) + dm
		e["hurt_anim"] = 1.0
		var hl: float = dm * float(c.get("ult_heal", 0.42))
		w["hp"] = minf(float(w.get("max_hp", 1)), float(w.get("hp", 0)) + hl)
		w["tot_heal"] = float(w.get("tot_heal", 0)) + hl
		e["shocked"] = true
		e["shocked_end"] = t + 3000
		if not e.get("stealthed", false):
			e["stun_end"] = t + 250
		_sp_float(float(e.get("x", 0)), float(e.get("y", CombatConstants.GY)) - 65.0, "ZAP" + str(roundi(dm)), "#44ddbb")
		_sp_float(float(w.get("x", 0)), float(w.get("y", CombatConstants.GY)) - 55.0, "+" + str(roundi(hl)), "#44aa66")
		_add_log(t, "Storm " + str(roundi(dm)) + " heal " + str(roundi(hl)), "ult")


# ============ CUSTOM ULTIMATE PROC ============

func _proc_custom_ult(h: Dictionary, t: int, dt: int) -> void:
	var ult_idx = h.get("custom_ult_id")
	if ult_idx == null:
		return
	# Only Thunderstorm (idx 0) has a proc function
	if int(ult_idx) == 0:
		_proc_custom_thunderstorm(h, t, dt)


func _proc_custom_thunderstorm(h: Dictionary, t: int, dt: int) -> void:
	if not h.get("ult_active", false) or int(h.get("ult_strikes", 0)) <= 0:
		return
	h["ult_strike_timer"] = int(h.get("ult_strike_timer", 0)) + dt
	if int(h.get("ult_strike_timer", 0)) >= 450:
		h["ult_strike_timer"] = 0
		h["ult_strikes"] = int(h.get("ult_strikes", 0)) - 1
		var e: Dictionary = en(h)
		var dm: float = (120.0 + float(h.get("max_hp", 1500)) * 0.05) * (1.0 + float(h.get("spell_dmg_bonus", 0))) * (1.0 - minf(float(e.get("def", 0)) / 300.0, 0.8))
		e["hp"] = float(e.get("hp", 0)) - dm
		h["tot_dmg"] = float(h.get("tot_dmg", 0)) + dm
		e["hurt_anim"] = 1.0
		var hl: float = dm * 0.42
		h["hp"] = minf(float(h.get("max_hp", 1)), float(h.get("hp", 0)) + hl)
		h["tot_heal"] = float(h.get("tot_heal", 0)) + hl
		_sp_float(float(e.get("x", 0)), float(e.get("y", CombatConstants.GY)) - 65.0, "ZAP" + str(roundi(dm)), "#44ddbb")
		_sp_float(float(h.get("x", 0)), float(h.get("y", CombatConstants.GY)) - 55.0, "+" + str(roundi(hl)), "#44aa66")
		_add_log(t, "Storm " + str(roundi(dm)) + " heal " + str(roundi(hl)), "ult")


# ============ TARGETING ============
# Port of engine.js getTarget() lines 56-70

func _get_target(atk: Dictionary) -> Dictionary:
	var e: Dictionary = en(atk)
	# Check goading follower
	var fol: Dictionary = e.get("follower", {})
	if not fol.is_empty() and fol.get("alive", false) and fol.get("goading", false):
		var d_f: float = CombatMath.dst(atk, fol)
		if d_f <= float(atk.get("attack_range", 200)) and d_f <= float(fol.get("goad_range", 120)):
			return {"type": "follower", "tgt": fol, "owner": e}
	# Check arena followers
	var afs: Array = e.get("arena_followers", [])
	if not afs.is_empty():
		var nearest_af: Dictionary = {}
		var near_d: float = 99999.0
		for af in afs:
			if not af.get("alive", false):
				continue
			var d2: float = CombatMath.dst(atk, af)
			if d2 < near_d and d2 <= float(atk.get("attack_range", 200)) + 20.0:
				near_d = d2
				nearest_af = af
		if not nearest_af.is_empty():
			var hero_d: float = CombatMath.dst(atk, e)
			if near_d < hero_d * 0.8 or randf() < 0.25:
				return {"type": "arena_follower", "tgt": nearest_af, "owner": e}
	return {"type": "hero", "tgt": e, "owner": null}


func _pick_af_target(af: Dictionary, enemy_hero: Dictionary) -> Dictionary:
	var best: Dictionary = {}
	var best_dist: float = 99999.0
	var enemy_afs: Array = enemy_hero.get("arena_followers", [])
	for ef in enemy_afs:
		if not ef.get("alive", false):
			continue
		ef["_is_arena_follower"] = true
		ef["def"] = ef.get("def", 0)
		var d2: float = CombatMath.dst(af, ef)
		if d2 < best_dist:
			best_dist = d2
			best = ef
	var hero_d: float = CombatMath.dst(af, enemy_hero)
	if best.is_empty() or hero_d < best_dist * 0.7:
		best = enemy_hero
		best["_is_arena_follower"] = false
	else:
		best["_is_arena_follower"] = true
	return best


# ============ ATTACKS ============
# Port of engine.js doAttack() lines 88-107

func _do_attack(h: Dictionary, t: int) -> bool:
	if CombatMath.is_stunned(h, t):
		return false
	var e: Dictionary = en(h)
	var d: float = CombatMath.dst(h, e)

	var atk_range: float = float(h.get("attack_range", 200))
	if h.get("type", "") == "assassin":
		atk_range = float(h.get("melee_range", CombatConstants.MELEE)) if d <= float(h.get("melee_range", CombatConstants.MELEE)) else float(h.get("throw_range", 200))

	if d > atk_range + 10.0 and not (h.get("type", "") == "assassin" and d <= float(h.get("throw_range", 200))):
		return false

	h["atk_cnt"] = int(h.get("atk_cnt", 0)) + 1
	h["attack_anim"] = 1.0
	var tg: Dictionary = _get_target(h)
	var tx: float = float(tg["tgt"].get("x", float(e.get("x", 0))))
	var ty: float = float(tg["tgt"].get("y", CombatConstants.GY)) - (35.0 if tg["type"] == "hero" else 15.0)

	var hero_type: String = h.get("type", "")
	var is_melee: bool = false
	if hero_type == "assassin":
		is_melee = d <= float(h.get("melee_range", CombatConstants.MELEE))
	elif hero_type == "barbarian":
		is_melee = true
	elif hero_type == "custom":
		is_melee = float(h.get("preferred_range", 300)) < 100
	# wizard and ranger are ranged by default

	if is_melee:
		# Melee: resolve hit after brief delay (80ms conceptual, immediate in tick)
		_resolve_hit(h, tg, t, d, false)
	else:
		# Ranged: spawn projectile
		var p_type: String = "arrow"
		var p_speed: float = 520.0
		var p_col: String = "#c87a4a"
		if hero_type == "wizard":
			p_type = "bolt"
			p_speed = 650.0
			p_col = "#6aaa8a"
		elif hero_type == "assassin":
			p_type = "dagger"
			p_speed = 550.0
			p_col = "#6a9aba"
		elif hero_type == "custom":
			p_col = "#d8b858"

		var proj := {
			"x": float(h.get("x", 0)),
			"y": float(h.get("y", CombatConstants.GY)) - 30.0,
			"tx": tx, "ty": ty,
			"speed": p_speed, "color": p_col, "type": p_type, "time": 0.0,
			"attacker": h, "target_info": tg, "hit_time": t, "hit_dist": d,
		}
		projectiles.append(proj)
		projectile_spawned.emit(proj)

	# Break stealth on attack (unless shadow dance)
	if h.get("stealthed", false) and not (h.get("shadow_dance_active", false) and bt < int(h.get("shadow_dance_end", 0))):
		h["stealthed"] = false
		_add_log(t, str(h.get("name", "")) + " breaks stealth!", "stealth")

	return true


# ============ HIT RESOLUTION ============
# Port of engine.js resolveHit() lines 109-133

func _resolve_hit(atk: Dictionary, tg: Dictionary, t: int, d: float, is_ranged: bool) -> void:
	var e: Dictionary = en(atk)
	var tgt: Dictionary = tg["tgt"]

	# Follower target
	if tg["type"] == "follower":
		var dm: float = CombatMath.calc_dmg(atk, tg["owner"], is_ranged, absf(float(atk.get("x", 0)) - float(tgt.get("x", 0))), bt)
		tgt["hp"] = float(tgt.get("hp", 0)) - dm
		atk["tot_dmg"] = float(atk.get("tot_dmg", 0)) + dm
		tgt["hurt_anim"] = 1.0
		if atk.get("bl_active", false):
			atk["bl_dmg"] = float(atk.get("bl_dmg", 0)) + dm
		_sp_float(float(tgt.get("x", 0)), float(tgt.get("y", CombatConstants.GY)) - 50.0, "-" + str(roundi(dm)), str(atk.get("color", "#fff")))
		_add_log(t, str(atk.get("name", "")) + " > Pet " + str(roundi(dm)), "dmg")
		if atk.get("type", "") == "assassin":
			atk["combo"] = mini(int(atk.get("max_combo", 5)), int(atk.get("combo", 0)) + 1)
		if atk.get("type", "") == "assassin" and not is_ranged and int(atk.get("atk_cnt", 0)) % 2 == 0:
			CombatMath.add_bleed(tg["owner"], t)
		if float(tgt.get("hp", 0)) <= 0:
			_kill_follower(tg["owner"], t)
		return

	# Arena follower target
	if tg["type"] == "arena_follower":
		var af_dm: float = float(atk.get("base_dmg", 50)) * (1.0 - minf(float(tgt.get("def", 0)) / 300.0, 0.7)) * (0.85 + randf() * 0.3) * (1.0 - CombatConstants.AF_DMG_REDUCTION)
		af_dm = roundf(af_dm)
		tgt["hp"] = float(tgt.get("hp", 0)) - af_dm
		atk["tot_dmg"] = float(atk.get("tot_dmg", 0)) + af_dm
		tgt["hurt_anim"] = 1.0
		_sp_float(float(tgt.get("x", 0)), float(tgt.get("y", CombatConstants.GY)) - 40.0, "-" + str(roundi(af_dm)), str(atk.get("color", "#fff")))
		_add_log(t, str(atk.get("name", "")) + " > " + str(tgt.get("name", "")) + " " + str(roundi(af_dm)), "dmg")
		if float(tgt.get("hp", 0)) <= 0:
			if tgt.get("has_on_death", false) and FollowerAbilities.execute_on_death(tgt, t, self):
				pass  # Rebirth handled
			else:
				tgt["alive"] = false
				tgt["hp"] = 0
				_add_log(t, str(tgt.get("name", "")) + " slain!", "summon")
		return

	# Hero target — evasion check
	var g_hit: bool = atk.get("mark_next", false)
	if not g_hit and randf() < CombatMath.eff_ev(e, bt):
		_sp_float(float(e.get("x", 0)), float(e.get("y", CombatConstants.GY)) - 60.0, "MISS", "#888888")
		_add_log(t, str(atk.get("name", "")) + " misses", "miss")
		return
	atk["mark_next"] = false

	var dm: float = CombatMath.calc_dmg(atk, e, is_ranged, d, bt)

	# Shield absorption
	if e.get("shield_active", false):
		var ab: float = minf(dm, float(e.get("shield_hp", 0)))
		e["shield_hp"] = float(e.get("shield_hp", 0)) - ab
		var c: Dictionary = _cls(str(e.get("type", "")))
		atk["hp"] = float(atk.get("hp", 0)) - float(c.get("shield_reflect", 0))
		atk["hurt_anim"] = 1.0
		dm -= ab
		_sp_float(float(e.get("x", 0)), float(e.get("y", CombatConstants.GY)) - 60.0, "Shield -" + str(roundi(ab)), "#88ddff")
		_add_log(t, "Shield " + str(roundi(ab)) + ", reflect " + str(c.get("shield_reflect", 0)), "shock")
		if float(e.get("shield_hp", 0)) <= 0:
			e["shield_active"] = false
			_add_log(t, "Shield breaks!", "spell")
		if dm <= 0:
			atk["tot_dmg"] = float(atk.get("tot_dmg", 0)) + ab
			return

	# Death mark damage storage
	if e.get("death_mark_target", false) and bt < int(e.get("death_mark_end", 0)):
		e["death_mark_dmg"] = float(e.get("death_mark_dmg", 0)) + dm

	# Apply damage
	e["hp"] = float(e.get("hp", 0)) - dm
	atk["tot_dmg"] = float(atk.get("tot_dmg", 0)) + dm
	e["hurt_anim"] = 1.0
	if atk.get("bl_active", false):
		atk["bl_dmg"] = float(atk.get("bl_dmg", 0)) + dm

	# Riposte counter
	if e.get("riposte_active", false) and bt < int(e.get("riposte_end", 0)):
		e["riposte_active"] = false
		atk["hp"] = float(atk.get("hp", 0)) - float(e.get("riposte_dmg", 0))
		atk["hurt_anim"] = 1.0
		atk["stun_end"] = bt + 300
		_sp_float(float(atk.get("x", 0)), float(atk.get("y", CombatConstants.GY)) - 60.0, "RIPOSTE " + str(e.get("riposte_dmg", 0)), "#ccccff")
		_add_log(bt, "Riposte! " + str(e.get("riposte_dmg", 0)) + " counter", "spell")

	# Thorns reflection
	if e.get("thorns_active", false) and bt < int(e.get("thorns_end", 0)):
		var thorns_dm := roundi(dm * float(e.get("thorns_pct", 0)))
		atk["hp"] = float(atk.get("hp", 0)) - float(thorns_dm)
		atk["hurt_anim"] = 1.0
		_sp_float(float(atk.get("x", 0)), float(atk.get("y", CombatConstants.GY)) - 55.0, "THORNS " + str(thorns_dm), "#44cc44")
		_add_log(bt, "Thorns " + str(thorns_dm), "spell")

	# Passive gear thorns reflect
	if float(e.get("_thorns_reflect", 0.0)) > 0.0 and dm > 0:
		var gear_thorns := roundi(dm * float(e.get("_thorns_reflect", 0.0)))
		if gear_thorns > 0:
			atk["hp"] = float(atk.get("hp", 0)) - float(gear_thorns)
			atk["hurt_anim"] = 1.0

	var col: String = "#ffffff" if atk.get("stealthed", false) else str(atk.get("color", "#fff"))
	_sp_float(float(e.get("x", 0)), float(e.get("y", CombatConstants.GY)) - 60.0, "-" + str(roundi(dm)), col)
	_add_log(t, str(atk.get("name", "")) + " > " + str(e.get("name", "")) + " " + str(roundi(dm)), "dmg")
	damage_dealt.emit(atk, e, dm)

	# Class-specific on-hit effects
	var atk_type: String = atk.get("type", "")
	if atk_type == "ranger":
		if int(atk.get("atk_cnt", 0)) % 3 == 0:
			CombatMath.add_bleed(e, t)
		if atk.get("ult_active", false):
			CombatMath.add_bleed(e, t)
	elif atk_type == "wizard":
		CombatMath.add_charge(atk, 1)
	elif atk_type == "assassin":
		atk["combo"] = mini(int(atk.get("max_combo", 5)), int(atk.get("combo", 0)) + 1)
		if not is_ranged and int(atk.get("atk_cnt", 0)) % 2 == 0:
			CombatMath.add_bleed(e, t)
		if atk.get("envenomed", false) and bt < int(atk.get("envenomed_end", 0)):
			CombatMath.add_bleed(e, t)
	elif atk_type == "custom":
		if atk.get("envenomed", false) and bt < int(atk.get("envenomed_end", 0)):
			CombatMath.add_bleed(e, t)
		if atk.get("primal_active", false) and bt < int(atk.get("primal_end", 0)):
			CombatMath.add_bleed(e, t)
		atk["combo"] = mini(int(atk.get("max_combo", 5)), roundi(float(atk.get("combo", 0)) + 0.5))
	elif atk_type == "barbarian":
		var c2: Dictionary = _cls("barbarian")
		var ls: float = dm * (float(c2.get("lifesteal", 0)) + (float(c2.get("ult_lifesteal", 0)) if atk.get("ult_active", false) else 0.0))
		if ls > 0:
			atk["hp"] = minf(float(atk.get("max_hp", 1)), float(atk.get("hp", 0)) + ls)
			atk["tot_heal"] = float(atk.get("tot_heal", 0)) + ls

	# Stash lifesteal (dungeon items)
	if float(atk.get("_stash_lifesteal", 0)) > 0:
		var sls: float = dm * float(atk.get("_stash_lifesteal", 0))
		atk["hp"] = minf(float(atk.get("max_hp", 1)), float(atk.get("hp", 0)) + sls)
		atk["tot_heal"] = float(atk.get("tot_heal", 0)) + sls

	# Gear affix lifesteal
	if float(atk.get("_lifesteal", 0.0)) > 0:
		var gls: float = dm * float(atk.get("_lifesteal", 0.0))
		atk["hp"] = minf(float(atk.get("max_hp", 1)), float(atk.get("hp", 0)) + gls)
		atk["tot_heal"] = float(atk.get("tot_heal", 0)) + gls

	# Gear affix special procs
	var spec_affixes: Array = atk.get("_special_affixes", [])
	for affix in spec_affixes:
		var affix_id: String = str(affix.get("id", ""))
		var affix_val: float = float(affix.get("value", 0))
		match affix_id:
			"chain_lightning_proc":
				if randf() < affix_val:
					var cl_dmg := (60.0 + float(atk.get("max_hp", 1500)) * 0.02) * (1.0 - minf(float(e.get("def", 0)) / 300.0, 0.8))
					e["hp"] = float(e.get("hp", 0)) - cl_dmg
					atk["tot_dmg"] = float(atk.get("tot_dmg", 0)) + cl_dmg
					e["hurt_anim"] = 1.0
					_sp_float(float(e.get("x", 0)), float(e.get("y", CombatConstants.GY)) - 50.0, str(roundi(cl_dmg)), "#44ddbb")
					_add_log(t, "Lightning proc " + str(roundi(cl_dmg)), "shock")
			"slow_on_hit":
				if randf() < affix_val:
					e["slow"] = maxf(float(e.get("slow", 0.0)), 0.1)
					e["slow_end"] = maxi(int(e.get("slow_end", 0)), t + 1000)


func _kill_follower(owner: Dictionary, t: int) -> void:
	var fol: Dictionary = owner.get("follower", {})
	if fol.is_empty():
		return
	fol["alive"] = false
	owner["follower_alive"] = false
	_add_log(t, str(owner.get("name", "")) + "'s pet slain!", "summon")
	if owner.get("bl_active", false):
		owner["bl_end"] = int(owner.get("bl_end", 0)) + 500


# ============ DEATH CHECK ============
# Port of engine.js checkDeath() line 137

func _check_death(h: Dictionary, t: int) -> bool:
	if float(h.get("hp", 0)) <= 0 and h.get("last_stand_active", false) and bt < int(h.get("last_stand_end", 0)):
		h["hp"] = 1.0
		return false
	if float(h.get("hp", 0)) <= 0:
		h["hp"] = 0.0
		over = true
		var winner: Dictionary = en(h)
		_add_log(t, str(h.get("name", "")) + " slain! " + str(winner.get("name", "")) + " WINS!", "death")
		combat_ended.emit(winner)
		set_process(false)
		return true
	return false


# ============ MOVEMENT AI ============
# Port of movement.js moveAI() lines 6-31

func _move_ai(h: Dictionary, dt: int) -> void:
	if CombatMath.is_stunned(h, bt):
		return
	var e: Dictionary = en(h)
	var d: float = CombatMath.dst(h, e)
	var ms: float = CombatMath.get_ms(h, bt) * (float(dt) / 1000.0)
	var dir: float = 1.0 if float(e.get("x", 0)) > float(h.get("x", 0)) else -1.0
	h["facing"] = 1 if dir > 0 else -1

	# Check goading follower
	var ef: Dictionary = e.get("follower", {})
	if not ef.is_empty() and ef.get("alive", false) and ef.get("goading", false):
		var d_f: float = CombatMath.dst(h, ef)
		if d_f < float(ef.get("goad_range", 120)) and d_f > CombatConstants.MELEE:
			var f_dir: float = 1.0 if float(ef.get("x", 0)) > float(h.get("x", 0)) else -1.0
			h["x"] = float(h.get("x", 0)) + f_dir * ms
			h["state"] = "moving"
			_clamp_h(h)
			_clamp_y(h)
			return

	var hero_type: String = h.get("type", "")
	if hero_type == "wizard":
		if d < float(h.get("preferred_range", 380)) - 30.0:
			h["x"] = float(h.get("x", 0)) - dir * ms
			h["state"] = "moving"
		elif d > float(h.get("spell_range", 430)) - 10.0:
			h["x"] = float(h.get("x", 0)) + dir * ms
			h["state"] = "moving"
		else:
			h["state"] = "idle"
	elif hero_type == "ranger":
		if d > float(h.get("preferred_range", 340)) + 20.0:
			h["x"] = float(h.get("x", 0)) + dir * ms
			h["state"] = "moving"
		elif d < float(h.get("preferred_range", 340)) - 40.0 and not h.get("ult_active", false):
			h["x"] = float(h.get("x", 0)) - dir * ms
			h["state"] = "moving"
		else:
			h["state"] = "idle"
	elif hero_type == "barbarian":
		if d > float(h.get("attack_range", 70)) + 5.0:
			h["x"] = float(h.get("x", 0)) + dir * ms
			h["state"] = "moving"
		else:
			h["state"] = "idle"
	elif hero_type == "custom":
		if d > float(h.get("preferred_range", 300)) + 20.0:
			h["x"] = float(h.get("x", 0)) + dir * ms
			h["state"] = "moving"
		elif d < float(h.get("preferred_range", 300)) - 30.0:
			h["x"] = float(h.get("x", 0)) - dir * ms
			h["state"] = "moving"
		else:
			h["state"] = "idle"
	else:
		# Assassin
		if h.get("stealthed", false):
			h["x"] = float(h.get("x", 0)) + dir * ms * 1.3
			h["state"] = "moving"
		elif d > float(h.get("melee_range", CombatConstants.MELEE)) + 10.0:
			h["x"] = float(h.get("x", 0)) + dir * ms
			h["state"] = "moving"
		else:
			h["state"] = "idle"

	_move_y(h, e, ms, d)
	_clamp_h(h)
	_clamp_y(h)


# Port of movement.js moveY() lines 34-51
func _move_y(h: Dictionary, e: Dictionary, ms: float, _d: float) -> void:
	var ey: float = float(e.get("y", CombatConstants.GY))
	var hy: float = float(h.get("y", CombatConstants.GY))
	var yms: float = ms * CombatConstants.STRAFE_SPEED
	var hero_type: String = h.get("type", "")
	var is_melee: bool = hero_type == "barbarian" or (hero_type == "assassin" and not h.get("stealthed", false)) or (hero_type == "custom" and float(h.get("preferred_range", 300)) < 100)
	if is_melee:
		var dy: float = ey - hy
		if absf(dy) > 8.0:
			h["y"] = hy + (1.0 if dy > 0 else -1.0) * yms
	else:
		if not h.has("_strafe_target") or not h.has("_strafe_timer") or bt > int(h.get("_strafe_timer", 0)):
			h["_strafe_target"] = CombatConstants.GY_MIN + randf() * float(CombatConstants.GY_MAX - CombatConstants.GY_MIN)
			h["_strafe_timer"] = bt + 1500 + roundi(randf() * 2000.0)
		var dy2: float = float(h.get("_strafe_target", CombatConstants.GY)) - hy
		if absf(dy2) > 5.0:
			h["y"] = hy + (1.0 if dy2 > 0 else -1.0) * yms


func _clamp_h(h: Dictionary) -> void:
	h["x"] = clampf(float(h.get("x", 0)), float(CombatConstants.AX + 25), float(CombatConstants.AX + CombatConstants.AW - 25))


func _clamp_y(h: Dictionary) -> void:
	h["y"] = clampf(float(h.get("y", CombatConstants.GY)), float(CombatConstants.GY_MIN), float(CombatConstants.GY_MAX))


# Port of movement.js moveFollower() lines 56-65
func _move_follower(fl: Dictionary, owner: Dictionary, target: Dictionary, dt: int) -> void:
	if fl.is_empty() or not fl.get("alive", false):
		return
	var ms2: float = float(fl.get("move_speed", 140)) * (float(dt) / 1000.0)
	var dx: float = float(target.get("x", 0)) - float(fl.get("x", 0))
	var d2: float = absf(dx)
	var dir2: float = 1.0 if dx > 0 else -1.0
	if d2 > float(fl.get("attack_range", CombatConstants.MELEE)):
		fl["x"] = float(fl.get("x", 0)) + dir2 * ms2
	fl["x"] = clampf(float(fl.get("x", 0)), float(CombatConstants.AX + 15), float(CombatConstants.AX + CombatConstants.AW - 15))
	var dy: float = float(target.get("y", CombatConstants.GY)) - float(fl.get("y", CombatConstants.GY))
	if absf(dy) > 5.0:
		fl["y"] = float(fl.get("y", CombatConstants.GY)) + (1.0 if dy > 0 else -1.0) * ms2 * 0.5
	fl["y"] = clampf(float(fl.get("y", CombatConstants.GY)), float(CombatConstants.GY_MIN), float(CombatConstants.GY_MAX))


# ============ SPELL AI ============
# Port of buffs.js spellAI() line 12

func _spell_ai(h: Dictionary, t: int) -> void:
	var hero_type: String = h.get("type", "")
	match hero_type:
		"wizard":
			_wiz_ai(h, t)
		"ranger":
			_rgr_ai(h, t)
		"barbarian":
			_barb_ai(h, t)
		"custom":
			_custom_ai(h, t)
		"assassin":
			_asn_ai(h, t)


# Port of buffs.js wizAI() lines 14-43
func _wiz_ai(w: Dictionary, t: int) -> void:
	if CombatMath.is_stunned(w, t):
		return
	var e: Dictionary = en(w)
	var d: float = CombatMath.dst(w, e)
	var hp_pct: float = float(w.get("hp", 0)) / maxf(1.0, float(w.get("max_hp", 1)))
	var c: Dictionary = _cls("wizard")

	# Ultimate
	if not w.get("spells", {}).get("ultimate", {}).get("used", false) and hp_pct < float(c.get("ult_threshold", 0.25)):
		w["spells"]["ultimate"]["used"] = true
		w["ult_active"] = true
		w["ult_end"] = t + int(c.get("ult_dur", 2500))
		w["ult_strikes"] = int(c.get("ult_strikes", 5))
		w["ult_strike_timer"] = 0
		w["cast_anim"] = 1.0
		CombatMath.add_charge(w, 5)
		_add_log(t, "ZAP " + str(w.get("name", "")) + " THUNDERSTORM!", "ult")
		spell_cast.emit(w, "Thunderstorm")
		return

	# Chain Lightning
	var cl_spell: Dictionary = w.get("spells", {}).get("chain_lightning", {})
	if float(cl_spell.get("cd", 1)) <= 0 and float(w.get("mana", 0)) >= float(c.get("chain_cost", 35)) and d <= float(w.get("spell_range", 430)):
		w["mana"] = float(w.get("mana", 0)) - float(c.get("chain_cost", 35))
		cl_spell["cd"] = float(c.get("chain_bcd", 5000))
		w["cast_anim"] = 1.0
		if randf() < CombatMath.eff_ev(e, t) * 0.6:
			CombatMath.add_charge(w, 1)
			_add_log(t, "Chain Zap DODGED!", "miss")
			return
		var dm: float = float(c.get("chain_dmg", 260)) * CombatMath.get_sdm(w) * (1.0 - minf(float(e.get("def", 0)) / 300.0, 0.8))
		if e.get("type", "") == "barbarian" and float(_cls("barbarian").get("spell_dodge", 0)) > 0 and randf() < float(_cls("barbarian").get("spell_dodge", 0)):
			dm *= 0.5
			_sp_float(float(e.get("x", 0)), float(e.get("y", CombatConstants.GY)) - 40.0, "RESIST", "#ff8888")
		# Target hero or follower (simplified — target hero)
		e["hp"] = float(e.get("hp", 0)) - dm
		w["tot_dmg"] = float(w.get("tot_dmg", 0)) + dm
		e["hurt_anim"] = 1.0
		_sp_float(float(e.get("x", 0)), float(e.get("y", CombatConstants.GY)) - 60.0, "ZAP" + str(roundi(dm)), "#44ddbb")
		_add_log(t, "Chain > " + str(e.get("name", "")) + " " + str(roundi(dm)), "shock")
		# Bounce to follower
		var efol: Dictionary = e.get("follower", {})
		if not efol.is_empty() and efol.get("alive", false):
			var b2: float = dm * float(c.get("chain_bounce", 0.5))
			efol["hp"] = float(efol.get("hp", 0)) - b2
			efol["hurt_anim"] = 1.0
			if float(efol.get("hp", 0)) <= 0:
				_kill_follower(e, t)
		e["shocked"] = true
		e["shocked_end"] = t + 3000
		e["slow"] = float(c.get("chain_slow", 0.12))
		e["slow_end"] = t + int(c.get("chain_slow_dur", 1500))
		if not e.get("stealthed", false) and not (e.get("type", "") == "barbarian" and float(_cls("barbarian").get("stun_resist", 0)) > 0 and randf() < float(_cls("barbarian").get("stun_resist", 0))):
			e["stun_end"] = t + int(c.get("chain_stun", 450))
			_add_log(t, str(e.get("name", "")) + " STUNNED " + str(c.get("chain_stun", 450)) + "ms!", "stun")
		CombatMath.add_charge(w, 1)
		spell_cast.emit(w, "Chain Lightning")

	# Lightning Bolt
	var lb_spell: Dictionary = w.get("spells", {}).get("lightning_bolt", {})
	if float(lb_spell.get("cd", 1)) <= 0 and float(w.get("mana", 0)) >= float(c.get("bolt_cost", 20)) and d <= float(w.get("spell_range", 430)):
		w["mana"] = float(w.get("mana", 0)) - float(c.get("bolt_cost", 20))
		lb_spell["cd"] = float(c.get("bolt_bcd", 2200))
		w["cast_anim"] = 1.0
		if randf() < CombatMath.eff_ev(e, t) * 0.6:
			_add_log(t, "Bolt DODGED!", "miss")
			return
		var dm2: float = float(c.get("bolt_dmg", 140)) * CombatMath.get_sdm(w) * (1.0 - minf(float(e.get("def", 0)) / 300.0, 0.8))
		if e.get("type", "") == "barbarian" and float(_cls("barbarian").get("spell_dodge", 0)) > 0 and randf() < float(_cls("barbarian").get("spell_dodge", 0)):
			dm2 *= 0.5
			_sp_float(float(e.get("x", 0)), float(e.get("y", CombatConstants.GY)) - 40.0, "RESIST", "#ff8888")
		e["hp"] = float(e.get("hp", 0)) - dm2
		w["tot_dmg"] = float(w.get("tot_dmg", 0)) + dm2
		e["hurt_anim"] = 1.0
		_sp_float(float(e.get("x", 0)), float(e.get("y", CombatConstants.GY)) - 50.0, "ZAP" + str(roundi(dm2)), "#88ffdd")
		_add_log(t, "Bolt > " + str(e.get("name", "")) + " " + str(roundi(dm2)), "shock")
		CombatMath.add_charge(w, 1)
		spell_cast.emit(w, "Lightning Bolt")

	# Static Shield
	var ss_spell: Dictionary = w.get("spells", {}).get("static_shield", {})
	if float(ss_spell.get("cd", 1)) <= 0 and float(w.get("mana", 0)) >= float(c.get("shield_cost", 45)) and hp_pct < 0.65 and not w.get("shield_active", false):
		w["mana"] = float(w.get("mana", 0)) - float(c.get("shield_cost", 45))
		ss_spell["cd"] = float(c.get("shield_bcd", 10000))
		w["shield_active"] = true
		w["shield_hp"] = float(c.get("shield_hp", 420))
		w["shield_end"] = t + int(c.get("shield_dur", 5000))
		w["cast_anim"] = 1.0
		CombatMath.add_charge(w, 1)
		_add_log(t, str(w.get("name", "")) + " Shield (" + str(c.get("shield_hp", 420)) + ")!", "spell")
		spell_cast.emit(w, "Static Shield")


# Port of buffs.js rgrAI() lines 47-54
func _rgr_ai(r: Dictionary, t: int) -> void:
	if CombatMath.is_stunned(r, t):
		return
	var e: Dictionary = en(r)
	var e_b: int = CombatMath.bleed_count(e)
	var hp_pct: float = float(r.get("hp", 0)) / maxf(1.0, float(r.get("max_hp", 1)))

	# Ultimate
	if not r.get("spells", {}).get("ultimate", {}).get("used", false) and hp_pct < 0.2:
		r["spells"]["ultimate"]["used"] = true
		r["ult_active"] = true
		r["ult_end"] = t + 2000
		r["cast_anim"] = 1.0
		_add_log(t, "FIRE " + str(r.get("name", "")) + " RAIN OF FIRE!", "ult")
		var be: Dictionary = en(r)
		be["burning"] = true
		be["burn_end"] = t + 3000
		be["burn_dmg"] = roundi(float(r.get("base_dmg", 180)) * 0.5)
		spell_cast.emit(r, "Rain of Fire")
		return

	# Hunter's Mark
	var hm: Dictionary = r.get("spells", {}).get("hunters_mark", {})
	if float(hm.get("cd", 1)) <= 0 and e_b >= 1:
		var sl: float = 0.01 * float(e_b)
		e["slow"] = sl
		e["slow_end"] = t + 2000
		r["mark_next"] = true
		CombatMath.add_bleed(e, t)
		hm["cd"] = 8000.0
		r["cast_anim"] = 1.0
		_add_log(t, str(r.get("name", "")) + " Mark! Slow " + str(roundi(sl * 100)) + "%", "spell")
		spell_cast.emit(r, "Hunter's Mark")

	# Bloodlust
	var bl: Dictionary = r.get("spells", {}).get("bloodlust", {})
	if float(bl.get("cd", 1)) <= 0 and e_b >= 2:
		r["bl_active"] = true
		r["bl_end"] = t + 2500
		r["bl_dmg"] = 0.0
		bl["cd"] = 12000.0
		r["cast_anim"] = 1.0
		_add_log(t, str(r.get("name", "")) + " Bloodlust!", "spell")
		spell_cast.emit(r, "Bloodlust")

	# Sacrifice (Summon Pet)
	var sac: Dictionary = r.get("spells", {}).get("sacrifice", {})
	if float(sac.get("cd", 1)) <= 0 and not r.get("follower_alive", false) and r.get("bl_active", false):
		r["follower"] = _mk_follower(r)
		r["follower_alive"] = true
		sac["cd"] = 15000.0
		r["cast_anim"] = 1.0
		_add_log(t, str(r.get("name", "")) + " summons pet!", "summon")
		spell_cast.emit(r, "Summon Pet")


func _mk_follower(owner: Dictionary) -> Dictionary:
	return {
		"alive": true,
		"hp": float(owner.get("follower_max_hp", 450)),
		"max_hp": float(owner.get("follower_max_hp", 450)),
		"x": float(owner.get("x", 0)) + float(owner.get("facing", 1)) * 40.0,
		"y": float(owner.get("y", CombatConstants.GY)),
		"move_speed": 140.0,
		"attack_range": CombatConstants.MELEE,
		"goading": true,
		"goad_range": 120.0,
		"bob_phase": randf() * 6.28,
		"hurt_anim": 0.0,
	}


# Port of buffs.js asnAI() lines 56-63
func _asn_ai(a: Dictionary, t: int) -> void:
	if CombatMath.is_stunned(a, t):
		return
	var e: Dictionary = en(a)
	var d: float = CombatMath.dst(a, e)
	var hp_pct: float = float(a.get("hp", 0)) / maxf(1.0, float(a.get("max_hp", 1)))
	var c: Dictionary = _cls("assassin")

	# Ultimate
	if not a.get("spells", {}).get("ultimate", {}).get("used", false) and hp_pct < float(c.get("ult_threshold", 0.25)):
		a["spells"]["ultimate"]["used"] = true
		a["cast_anim"] = 1.0
		a["combo"] = int(a.get("max_combo", 5))
		e["death_mark_target"] = true
		e["death_mark_end"] = t + 3500
		e["death_mark_dmg"] = 0.0
		_sp_float(float(e.get("x", 0)), float(e.get("y", CombatConstants.GY)) - 70.0, "DEATH MARK", "#ff8800")
		_add_log(t, "SKULL " + str(a.get("name", "")) + " DEATH MARK!", "ult")
		spell_cast.emit(a, "Death Mark")
		return

	# Shadow Step
	var ss: Dictionary = a.get("spells", {}).get("shadow_step", {})
	if float(ss.get("cd", 1)) <= 0 and float(a.get("energy", 0)) >= 25.0 and d > 100.0 and not a.get("stealthed", false):
		a["energy"] = float(a.get("energy", 0)) - 25.0
		ss["cd"] = 3500.0
		a["cast_anim"] = 1.0
		var behind_x: float = float(e.get("x", 0)) + (50.0 if float(e.get("x", 0)) > float(a.get("x", 0)) else -50.0)
		a["x"] = clampf(behind_x, float(CombatConstants.AX + 25), float(CombatConstants.AX + CombatConstants.AW - 25))
		a["y"] = float(e.get("y", float(a.get("y", CombatConstants.GY))))
		a["stealthed"] = true
		a["stealth_end"] = t + 2000
		a["combo"] = mini(int(a.get("max_combo", 5)), int(a.get("combo", 0)) + 2)
		_add_log(t, str(a.get("name", "")) + " Shadow Step!", "stealth")
		spell_cast.emit(a, "Shadow Step")

	# Envenom
	var ev_spell: Dictionary = a.get("spells", {}).get("envenom", {})
	if float(ev_spell.get("cd", 1)) <= 0 and float(a.get("energy", 0)) >= 30.0 and d <= float(a.get("melee_range", CombatConstants.MELEE)) + 60.0:
		a["energy"] = float(a.get("energy", 0)) - 30.0
		ev_spell["cd"] = 8000.0
		a["cast_anim"] = 1.0
		a["envenomed"] = true
		a["envenomed_end"] = t + 5000
		a["combo"] = mini(int(a.get("max_combo", 5)), int(a.get("combo", 0)) + 1)
		_add_log(t, str(a.get("name", "")) + " Envenom!", "poison")
		spell_cast.emit(a, "Envenom")

	# Smoke Bomb
	var sb: Dictionary = a.get("spells", {}).get("smoke_bomb", {})
	if float(sb.get("cd", 1)) <= 0 and float(a.get("energy", 0)) >= 35.0 and hp_pct < 0.55 and not a.get("smoke_bomb_active", false):
		a["energy"] = float(a.get("energy", 0)) - 35.0
		sb["cd"] = 12000.0
		a["cast_anim"] = 1.0
		a["smoke_bomb_active"] = true
		a["smoke_bomb_end"] = t + 4000
		a["smoke_bomb_x"] = float(a.get("x", 0))
		_add_log(t, str(a.get("name", "")) + " Smoke Bomb!", "stealth")
		spell_cast.emit(a, "Smoke Bomb")


# Port of buffs.js barbAI() lines 65-70
func _barb_ai(b: Dictionary, t: int) -> void:
	if CombatMath.is_stunned(b, t):
		return
	var e: Dictionary = en(b)
	var d: float = CombatMath.dst(b, e)
	var hp_pct: float = float(b.get("hp", 0)) / maxf(1.0, float(b.get("max_hp", 1)))
	var c: Dictionary = _cls("barbarian")

	# Ultimate
	if not b.get("spells", {}).get("ultimate", {}).get("used", false) and hp_pct < float(c.get("ult_threshold", 0.30)):
		b["spells"]["ultimate"]["used"] = true
		b["ult_active"] = true
		b["ult_end"] = t + int(c.get("ult_dur", 4000))
		b["cast_anim"] = 1.0
		_sp_float(float(b.get("x", 0)), float(b.get("y", CombatConstants.GY)) - 70.0, "BERSERKER", "#ff4444")
		_add_log(t, "SKULL " + str(b.get("name", "")) + " BERSERKER RAGE!", "ult")
		spell_cast.emit(b, "Berserker Rage")
		return

	# Charge
	var ch: Dictionary = b.get("spells", {}).get("charge", {})
	if float(ch.get("cd", 1)) <= 0 and d >= float(c.get("charge_min_range", 100)) and d <= float(c.get("charge_range", 350)):
		ch["cd"] = float(c.get("charge_bcd", 5500))
		b["cast_anim"] = 1.0
		var dir3: float = 1.0 if float(e.get("x", 0)) > float(b.get("x", 0)) else -1.0
		b["x"] = clampf(float(e.get("x", 0)) - dir3 * 45.0, float(CombatConstants.AX + 25), float(CombatConstants.AX + CombatConstants.AW - 25))
		b["y"] = float(e.get("y", float(b.get("y", CombatConstants.GY))))
		var dm3: float = float(c.get("charge_dmg", 200)) * (1.0 - minf(float(e.get("def", 0)) / 300.0, 0.8)) * CombatMath.get_rage(b).d
		if b.get("ult_active", false):
			dm3 *= (1.0 + float(c.get("ult_dmg", 0)))
		e["hp"] = float(e.get("hp", 0)) - dm3
		b["tot_dmg"] = float(b.get("tot_dmg", 0)) + dm3
		e["hurt_anim"] = 1.0
		_sp_float(float(e.get("x", 0)), float(e.get("y", CombatConstants.GY)) - 60.0, "BOOM" + str(roundi(dm3)), "#cc4444")
		_add_log(t, str(b.get("name", "")) + " CHARGE " + str(roundi(dm3)) + "!", "dmg")
		var ls2: float = dm3 * (float(c.get("lifesteal", 0)) + (float(c.get("ult_lifesteal", 0)) if b.get("ult_active", false) else 0.0))
		b["hp"] = minf(float(b.get("max_hp", 1)), float(b.get("hp", 0)) + ls2)
		if ls2 > 1.0:
			b["tot_heal"] = float(b.get("tot_heal", 0)) + ls2
			_sp_float(float(b.get("x", 0)), float(b.get("y", CombatConstants.GY)) - 50.0, "+" + str(roundi(ls2)), "#44aa66")
		spell_cast.emit(b, "Charge")

	# War Cry
	var wc: Dictionary = b.get("spells", {}).get("war_cry", {})
	if float(wc.get("cd", 1)) <= 0 and d <= float(c.get("war_cry_range", 150)):
		wc["cd"] = float(c.get("war_cry_bcd", 10000))
		b["cast_anim"] = 1.0
		e["slow"] = float(c.get("war_cry_slow", 0.25))
		e["slow_end"] = t + int(c.get("war_cry_slow_dur", 2500))
		_add_log(t, str(b.get("name", "")) + " WAR CRY! Slow " + str(roundi(float(c.get("war_cry_slow", 0.25)) * 100)) + "%", "spell")
		spell_cast.emit(b, "War Cry")


# Port of buffs.js customAI() lines 73-80
func _custom_ai(h: Dictionary, t: int) -> void:
	if CombatMath.is_stunned(h, t):
		return
	# Resource regen
	h["resource"] = minf(float(h.get("max_resource", 100)), float(h.get("resource", 0)) + float(h.get("resource_regen", 2)) * (float(CombatConstants.TK) / 1000.0))

	var free_mode: bool = h.get("free_spells_active", false) and bt < int(h.get("free_spells_end", 0))
	var saved_res: float = float(h.get("resource", 0)) if free_mode else -1.0
	if free_mode:
		h["resource"] = 9999.0

	# Try ultimate
	var ult_idx = h.get("custom_ult_id")
	if ult_idx != null and h.get("spells", {}).has("ultimate") and not h.get("spells", {}).get("ultimate", {}).get("used", false):
		if SkillAI.try_cast_ult(int(ult_idx), h, t, self):
			if free_mode:
				h["resource"] = saved_res
			return

	# Try skills
	var skill_ids: Array = h.get("custom_skill_ids", [])
	for sk in skill_ids:
		var spell_dict: Dictionary = h.get("spells", {}).get(str(sk.get("key", "")), {})
		if spell_dict.is_empty() or float(spell_dict.get("cd", 1)) > 0:
			continue
		if SkillAI.try_cast_skill(int(sk.get("idx", 0)), h, t, self):
			if free_mode:
				h["resource"] = saved_res
			return

	if free_mode:
		h["resource"] = saved_res


# ============ ARENA FOLLOWER TICK ============
# Port of engine.js lines 153-207

func _tick_arena_followers(dts: float, dt: int) -> void:
	for h in [h1, h2]:
		var afs: Array = h.get("arena_followers", [])
		if afs.is_empty():
			continue
		var enemy: Dictionary = en(h)
		for af in afs:
			if not af.get("alive", false):
				continue
			var tgt: Dictionary = _pick_af_target(af, enemy)
			if tgt.is_empty():
				continue

			# Movement
			var dx: float = float(tgt.get("x", 0)) - float(af.get("x", 0))
			var dist2: float = CombatMath.dst(af, tgt)
			var dir_x: float = 1.0 if dx > 0 else -1.0
			if dist2 > float(af.get("attack_range", 60)):
				af["x"] = float(af.get("x", 0)) + dir_x * float(af.get("move_speed", 100)) * dts
				af["x"] = clampf(float(af.get("x", 0)), float(CombatConstants.AX + 15), float(CombatConstants.AX + CombatConstants.AW - 15))
				var dy2: float = float(tgt.get("y", CombatConstants.GY)) - float(af.get("y", CombatConstants.GY))
				if absf(dy2) > 5.0:
					af["y"] = float(af.get("y", CombatConstants.GY)) + (1.0 if dy2 > 0 else -1.0) * float(af.get("move_speed", 100)) * dts * 0.5
				af["y"] = clampf(float(af.get("y", CombatConstants.GY)), float(CombatConstants.GY_MIN), float(CombatConstants.GY_MAX))

			# Attack
			af["atk_cd"] = float(af.get("atk_cd", 0)) - float(dt)
			if float(af.get("atk_cd", 0)) <= 0 and dist2 <= float(af.get("attack_range", 60)) + 15.0:
				af["atk_cd"] = 1000.0 / float(af.get("base_as", 1.0))
				af["attack_anim"] = 1.0
				var af_def: float = float(tgt.get("def", 0))
				var dm4: float = float(af.get("base_dmg", 30)) * (1.0 - minf(maxf(0.0, af_def) / 300.0, 0.7))
				dm4 *= (0.85 + randf() * 0.3)
				dm4 = roundf(dm4)
				tgt["hp"] = float(tgt.get("hp", 0)) - dm4
				af["tot_dmg"] = float(af.get("tot_dmg", 0)) + dm4
				tgt["hurt_anim"] = 1.0
				_sp_float(float(tgt.get("x", 0)), float(tgt.get("y", CombatConstants.GY)) - 40.0, "-" + str(roundi(dm4)), str(af.get("color", "#aaa")))

				if tgt.get("_is_arena_follower", false) and float(tgt.get("hp", 0)) <= 0:
					if tgt.get("has_on_death", false) and FollowerAbilities.execute_on_death(tgt, bt, self):
						pass
					else:
						tgt["alive"] = false
						tgt["hp"] = 0
						_add_log(bt, str(af.get("name", "")) + " slays " + str(tgt.get("name", "")) + "!", "summon")
				if not tgt.get("_is_arena_follower", false) and float(tgt.get("hp", 0)) <= 0:
					if _check_death(enemy, bt):
						return

			# Ability
			if af.get("ability_name", "") != "":
				af["ability_cd"] = float(af.get("ability_cd", 0)) - float(dt)
				if float(af.get("ability_cd", 0)) <= 0:
					af["ability_cd"] = float(af.get("ability_bcd", 6000))
					af["attack_anim"] = 1.0
					FollowerAbilities.execute_ability(af, tgt, bt, self)
					if float(enemy.get("hp", 0)) <= 0:
						if _check_death(enemy, bt):
							return
					if tgt.get("_is_arena_follower", false) and float(tgt.get("hp", 0)) <= 0:
						if tgt.get("has_on_death", false) and FollowerAbilities.execute_on_death(tgt, bt, self):
							pass
						else:
							tgt["alive"] = false
							tgt["hp"] = 0

			# Animation
			af["bob_phase"] = float(af.get("bob_phase", 0)) + dts * 4.0
			if float(af.get("attack_anim", 0)) > 0:
				af["attack_anim"] = maxf(0.0, float(af.get("attack_anim", 0)) - dts * 5.0)
			if float(af.get("hurt_anim", 0)) > 0:
				af["hurt_anim"] = maxf(0.0, float(af.get("hurt_anim", 0)) - dts * 4.0)


# ============ PROJECTILE UPDATES ============

func _update_projectiles(delta: float) -> void:
	var i := projectiles.size() - 1
	while i >= 0:
		var p: Dictionary = projectiles[i]
		var dx: float = float(p.get("tx", 0)) - float(p.get("x", 0))
		var dy: float = float(p.get("ty", 0)) - float(p.get("y", 0))
		var dist2: float = sqrt(dx * dx + dy * dy)
		var move: float = float(p.get("speed", 500)) * delta
		if move >= dist2:
			# Arrived — resolve hit
			if p.has("attacker") and p.has("target_info"):
				_resolve_hit(p["attacker"], p["target_info"], int(p.get("hit_time", bt)), float(p.get("hit_dist", 0)), true)
			projectiles.remove_at(i)
		else:
			var ratio: float = move / dist2
			p["x"] = float(p.get("x", 0)) + dx * ratio
			p["y"] = float(p.get("y", 0)) + dy * ratio
			p["time"] = float(p.get("time", 0)) + delta
		i -= 1
