extends Node
## Loads followers.json and provides crafting, upgrading, and template lookups.

var _templates: Array[Dictionary] = []
var _craft_costs: Dictionary = {}
var _upgrade_cost: int = 30
var _max_upgrades: int = 3
var _rarity_colors: Dictionary = {}
var _gs: Node  # GameState ref


func _ready() -> void:
	_gs = get_node("/root/GameState")
	_load_data()


func _load_data() -> void:
	var file = FileAccess.open("res://data/followers.json", FileAccess.READ)
	if not file:
		push_error("Cannot load followers.json")
		return
	var raw = JSON.parse_string(file.get_as_text())
	file.close()
	if not raw is Dictionary:
		push_error("followers.json is not a Dictionary")
		return

	_craft_costs = raw.get("craft_costs", {})
	_upgrade_cost = int(raw.get("upgrade_cost", 30))
	_max_upgrades = int(raw.get("max_upgrades", 3))
	_rarity_colors = raw.get("rarity_colors", {})

	for entry in raw.get("templates", []):
		_templates.append(entry)


func get_template(template_name: String) -> Dictionary:
	for t in _templates:
		if t.get("name", "") == template_name:
			return t
	return {}


func get_template_by_index(idx: int) -> Dictionary:
	if idx >= 0 and idx < _templates.size():
		return _templates[idx]
	return {}


func get_templates_by_rarity(rarity: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for t in _templates:
		if t.get("rarity", "") == rarity:
			result.append(t)
	return result


func get_all_templates() -> Array[Dictionary]:
	return _templates


func get_craft_cost(rarity: String) -> int:
	return int(_craft_costs.get(rarity, 999))


func get_upgrade_cost() -> int:
	return _upgrade_cost


func get_max_upgrades() -> int:
	return _max_upgrades


func get_rarity_color(rarity: String) -> String:
	return _rarity_colors.get(rarity, "#8a8a7a")


func craft_follower(rarity: String) -> Dictionary:
	## Pay dust and receive a random follower of the given rarity.
	var cost = get_craft_cost(rarity)
	if not _gs.spend_dust(cost):
		return {}

	var candidates = get_templates_by_rarity(rarity)
	if candidates.is_empty():
		# Refund
		_gs.add_dust(cost)
		return {}

	var chosen = candidates[randi() % candidates.size()]
	var instance: Dictionary = {
		"template_name": chosen.get("name", "Unknown"),
		"upgrades": 0,
		"combat_hp": int(chosen.get("combat_hp", 400)),
		"combat_dmg": int(chosen.get("combat_dmg", 30)),
		"combat_as": float(chosen.get("combat_as", 1.0)),
		"combat_def": int(chosen.get("combat_def", 10)),
		"combat_range": int(chosen.get("combat_range", 60)),
	}
	return instance


func upgrade_follower(follower: Dictionary) -> bool:
	## Upgrade a follower's combat stats (max 3 times). Returns true on success.
	var current_upgrades = int(follower.get("upgrades", 0))
	if current_upgrades >= _max_upgrades:
		return false
	if not _gs.spend_dust(_upgrade_cost):
		return false

	follower["upgrades"] = current_upgrades + 1
	follower["combat_hp"] = roundi(float(follower.get("combat_hp", 400)) * 1.15)
	follower["combat_dmg"] = roundi(float(follower.get("combat_dmg", 30)) * 1.15)
	follower["combat_def"] = roundi(float(follower.get("combat_def", 10)) * 1.15)
	return true


const FOLLOWER_DUST_VALUES: Dictionary = {
	"common": 3, "uncommon": 10, "rare": 25,
	"epic": 60, "legendary": 150, "mythic": 300,
}


func get_dust_value(follower: Dictionary) -> int:
	var rarity: String = str(follower.get("rarity", "common"))
	return int(FOLLOWER_DUST_VALUES.get(rarity, 3))
