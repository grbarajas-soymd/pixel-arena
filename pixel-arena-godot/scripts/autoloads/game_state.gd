extends Node
## Global game state singleton — mirrors the JS gameState.js
## Holds current character, progression, and session data.

signal state_changed
signal dust_changed(amount: int)
signal gold_changed(amount: int)

# Character slots (up to 3)
var slots: Array[Dictionary] = []
var active_slot: int = 0

# Current character state
var custom_char: Dictionary = {}
var equipment: Dictionary = {}  # slot_name -> gear instance dict
var gear_bag: Array[Dictionary] = []
var followers: Array[Dictionary] = []
var active_follower: int = -1

# Currencies
var gold: int = 0
var dust: int = 0

# Progression
var dungeon_clears: int = 0
var ladder_wins: int = 0
var arena_rating: int = 1000
var potions: int = 3
var max_potions: int = 3

# Dungeon run state — persistent across scene changes
var dungeon_floor: int = 0
var dungeon_rooms_cleared: int = 0
var dungeon_visited_rooms: Array[String] = []
var dg_run: Dictionary = {}  # Empty = no active run

# Ladder run state — persistent across scene changes
var _ladder_mode: bool = false
var _ladder_opponent: Dictionary = {}
var _ladder_result: String = ""  # "win" or "loss"
var ladder_best: int = 0
var ladder_run: Dictionary = {}  # {wins, active, opponent_idx, history, fighters, staked}

# Arena state
var _arena_opponent_build: Dictionary = {}
var _arena_fighters: Array = []
var _arena_staked: Dictionary = {}

# Settings
var sfx_enabled: bool = true
var music_enabled: bool = true
var auto_battle_speed: float = 1.0
var sfx_volume: float = 0.8
var music_volume: float = 0.8


func _ready() -> void:
	pass


func add_dust(amount: int) -> void:
	dust += amount
	dust_changed.emit(dust)
	state_changed.emit()


func spend_dust(amount: int) -> bool:
	if dust < amount:
		return false
	dust -= amount
	dust_changed.emit(dust)
	state_changed.emit()
	return true


func add_gold(amount: int) -> void:
	gold += amount
	gold_changed.emit(gold)
	state_changed.emit()


func spend_gold(amount: int) -> bool:
	if gold < amount:
		return false
	gold -= amount
	gold_changed.emit(gold)
	state_changed.emit()
	return true


func get_total_stats() -> Dictionary:
	## Calculate total hero stats from base class + equipment + follower buffs
	var stats: Dictionary = custom_char.duplicate(true)

	# Add equipment stats
	for slot_name in equipment:
		var gear = equipment[slot_name]
		if gear and gear.has("stats"):
			for stat_key in gear.stats:
				if stats.has(stat_key):
					stats[stat_key] += gear.stats[stat_key]
				else:
					stats[stat_key] = gear.stats[stat_key]

	# Add active follower buff (runtime lookup to avoid circular compile dep)
	if active_follower >= 0 and active_follower < followers.size():
		var fl = followers[active_follower]
		var fdb = get_node_or_null("/root/FollowerDatabase")
		if fdb:
			var tmpl = fdb.get_template(fl.get("template_name", ""))
			if tmpl and tmpl.has("buff"):
				for stat_key in tmpl.buff:
					if stats.has(stat_key):
						stats[stat_key] += tmpl.buff[stat_key]
					else:
						stats[stat_key] = tmpl.buff[stat_key]

	return stats


func get_special_affixes() -> Array:
	## Collect all special (proc) affixes from equipped gear — those with _ prefix IDs
	var result: Array = []
	for slot_name in equipment:
		var gear = equipment[slot_name]
		if gear and gear is Dictionary:
			var affixes: Array = gear.get("affixes", [])
			for affix in affixes:
				if not affix.get("stat", false):
					result.append(affix)
	return result


func get_weapon_range_type() -> String:
	var weapon = equipment.get("weapon")
	if weapon:
		var idb = get_node_or_null("/root/ItemDatabase")
		if idb:
			var tmpl = idb.get_template(weapon.get("base_key", ""))
			if tmpl:
				return tmpl.get("range_type", "melee")
	return "melee"


func start_dungeon_run() -> void:
	## Initialize a new dungeon run with hero stats, mirroring JS startDungeon()
	var stats = get_total_stats()
	var hero_hp = roundi(float(stats.get("hp", 4000)) * 0.85)
	var hero_dmg = roundi(float(stats.get("base_dmg", 100)))
	var hero_as = float(stats.get("base_as", 0.8))
	var hero_def = int(stats.get("def", 40))
	var hero_eva = float(stats.get("evasion", 0.0))
	var max_mana = maxi(100, int(stats.get("mana", 0)))
	var mana_regen = maxi(4, int(stats.get("mana_regen", 0)))
	var hero_crit = float(stats.get("crit_chance", 0.0))
	var hero_lifesteal = float(stats.get("lifesteal", 0.0))
	var hero_thorns = float(stats.get("thorns_reflect", 0.0))
	var hero_hp_regen = int(stats.get("hp_regen", 0))
	var hero_dmg_reduction = float(stats.get("dmg_reduction", 0.0))
	var hero_fire_dmg = float(stats.get("fire_dmg", 0.0))
	var hero_ice_dmg = float(stats.get("ice_dmg", 0.0))
	var hero_lightning_dmg = float(stats.get("lightning_dmg", 0.0))

	dg_run = {
		"hero_name": custom_char.get("name", "Hero"),
		"hero_class": custom_char.get("class_key", "barbarian"),
		"hp": hero_hp,
		"max_hp": hero_hp,
		"base_dmg": hero_dmg,
		"base_as": hero_as,
		"def": hero_def,
		"evasion": hero_eva,
		"floor": 1,
		"room": 0,
		"gold": 0,
		"items": [],
		"followers": [],
		"log": [],
		"state": "exploring",
		"combat_enemy": {},
		"combat_turn": 0,
		"potions": 3,
		"max_potions": 3,
		"bonus_dmg": 0,
		"bonus_def": 0,
		"bonus_hp": 0,
		"bonus_as": 0.0,
		"mana": max_mana,
		"max_mana": max_mana,
		"mana_regen": mana_regen,
		"spell_cost": 35,
		"deployed_follower": {},
		"room_history": [],
		"total_kills": 0,
		"total_dmg_dealt": 0,
		"total_dmg_taken": 0,
		"last_combat_stats": {},
		"last_non_boss_room": "",
		"pending_gear_drop": {},
		"pending_item": {},
		"pending_shrine": {},
		"pending_treasure_gear": {},
		"pending_capture_follower": {},
		"pending_capture_sell_price": 0,
		"shop_items": [],
		"shop_gear": [],
		"crit_chance": hero_crit,
		"lifesteal": hero_lifesteal,
		"thorns_reflect": hero_thorns,
		"hp_regen": hero_hp_regen,
		"dmg_reduction": hero_dmg_reduction,
		"fire_dmg": hero_fire_dmg,
		"ice_dmg": hero_ice_dmg,
		"lightning_dmg": hero_lightning_dmg,
		"special_affixes": get_special_affixes(),
	}
	# Apply bonus HP
	dg_run["hp"] += dg_run["bonus_hp"]
	dg_run["max_hp"] += dg_run["bonus_hp"]
	state_changed.emit()


func has_active_run() -> bool:
	return not dg_run.is_empty() and dg_run.get("state", "") != ""


func dg_log(msg: String, msg_type: String = "info") -> void:
	if dg_run.is_empty():
		return
	var log_array: Array = dg_run.get("log", [])
	log_array.append({"msg": msg, "type": msg_type})
	dg_run["log"] = log_array


func apply_follower_buff_to_run(f: Dictionary) -> String:
	## Apply a follower's passive buffs to the active dungeon run. Returns description.
	if f.is_empty() or dg_run.is_empty():
		return ""
	var fdb = get_node_or_null("/root/FollowerDatabase")
	if not fdb:
		return ""
	var tmpl = fdb.get_template(f.get("template_name", f.get("name", "")))
	if tmpl.is_empty() or not tmpl.has("buff"):
		return ""
	var buff: Dictionary = tmpl.get("buff", {})
	var parts: Array[String] = []
	if buff.has("base_dmg"):
		dg_run["bonus_dmg"] = int(dg_run.get("bonus_dmg", 0)) + int(buff["base_dmg"])
		parts.append("+" + str(int(buff["base_dmg"])) + " DMG")
	if buff.has("def"):
		dg_run["bonus_def"] = int(dg_run.get("bonus_def", 0)) + int(buff["def"])
		parts.append("+" + str(int(buff["def"])) + " DEF")
	if buff.has("hp"):
		var hp_val = int(buff["hp"])
		dg_run["max_hp"] = int(dg_run.get("max_hp", 0)) + hp_val
		dg_run["hp"] = int(dg_run.get("hp", 0)) + hp_val
		dg_run["bonus_hp"] = int(dg_run.get("bonus_hp", 0)) + hp_val
		parts.append("+" + str(hp_val) + " HP")
	if buff.has("base_as"):
		dg_run["bonus_as"] = float(dg_run.get("bonus_as", 0.0)) + float(buff["base_as"])
		parts.append("+" + str(snapped(float(buff["base_as"]), 0.01)) + " AS")
	if buff.has("evasion"):
		dg_run["evasion"] = minf(0.8, float(dg_run.get("evasion", 0.0)) + float(buff["evasion"]))
		parts.append("+" + str(roundi(float(buff["evasion"]) * 100.0)) + "% EVA")
	return ", ".join(parts)


func reset_dungeon_run() -> void:
	dg_run = {}
	dungeon_floor = 0
	dungeon_rooms_cleared = 0
	dungeon_visited_rooms.clear()
	potions = max_potions
	state_changed.emit()
