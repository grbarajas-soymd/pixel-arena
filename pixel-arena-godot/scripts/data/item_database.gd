extends Node
## Loads items.json and provides gear rolling, salvage, and template lookups.

var _items: Dictionary = {}
var _rarity_roll_config: Dictionary = {}
var _salvage_values: Dictionary = {}
var _rarity_colors: Dictionary = {}
var _affix_config: Dictionary = {}

# Stat labels for building descriptions
const STAT_LABELS: Dictionary = {
	"base_dmg": "DMG",
	"base_as": "AS",
	"def": "DEF",
	"hp": "HP",
	"evasion": "Eva",
	"move_speed": "Spd",
	"mana": "Mana",
	"mana_regen": "MP5",
	"energy": "Energy",
	"energy_regen": "EP5",
	"spell_dmg_bonus": "Spell%",
	"crit_chance": "Crit",
	"lifesteal": "LS",
	"thorns_reflect": "Thorns",
	"hp_regen": "HP5",
	"mana_regen_bonus": "MP5+",
	"bonus_hp": "HP+",
	"bonus_def": "DEF+",
	"fire_dmg": "Fire%",
	"ice_dmg": "Ice%",
	"lightning_dmg": "Lit%",
	"dmg_reduction": "DR",
}

# Stats that display as percentages
const PCT_STATS: Array[String] = [
	"evasion", "spell_dmg_bonus",
	"crit_chance", "lifesteal", "thorns_reflect",
	"fire_dmg", "ice_dmg", "lightning_dmg", "dmg_reduction",
]

# Stats that use decimal display (2 places)
const DECIMAL_STATS: Array[String] = ["base_as", "evasion", "spell_dmg_bonus"]


func _ready() -> void:
	_load_data()


func _load_data() -> void:
	var file = FileAccess.open("res://data/items.json", FileAccess.READ)
	if not file:
		push_error("Cannot load items.json")
		return
	var raw = JSON.parse_string(file.get_as_text())
	file.close()
	if not raw is Dictionary:
		push_error("items.json is not a Dictionary")
		return

	_rarity_roll_config = raw.get("_rarity_roll_config", {})
	_salvage_values = raw.get("_salvage_values", {})
	_rarity_colors = raw.get("_rarity_colors", {})
	_affix_config = raw.get("_affixes", {})

	# Everything else is an item template
	for key in raw:
		if key.begins_with("_"):
			continue
		_items[key] = raw[key]


func get_template(item_key: String) -> Dictionary:
	return _items.get(item_key, {})


func get_all_items() -> Dictionary:
	return _items


func get_rarity_color(rarity: String) -> String:
	return _rarity_colors.get(rarity, "#8a8a7a")


func get_salvage_value(gear_entry) -> int:
	## Get dust value for salvaging a gear piece
	var tmpl = _get_template_for_entry(gear_entry)
	if tmpl.is_empty():
		return 0
	var rarity = tmpl.get("rarity", "common")
	return int(_salvage_values.get(rarity, 0))


func roll_gear_instance(item_key: String) -> Dictionary:
	## Create a gear instance with D4-style rolled stats + affixes
	var tmpl = _items.get(item_key, {})
	if tmpl.is_empty():
		push_warning("Unknown item key: " + item_key)
		return {}

	var rarity = tmpl.get("rarity", "common")
	var config = _rarity_roll_config.get(rarity, {"floor_pct": 0.9, "ceil_pct": 1.1})
	var floor_pct = float(config.get("floor_pct", 0.9))
	var ceil_pct = float(config.get("ceil_pct", 1.1))

	var template_stats: Dictionary = tmpl.get("stats", {})
	var rolled_stats: Dictionary = {}
	var quality_sum: float = 0.0
	var stat_count: int = 0

	for stat_key in template_stats:
		var base_val = float(template_stats[stat_key])
		var low = base_val * floor_pct
		var high = base_val * ceil_pct
		var rolled = randf_range(low, high)

		# Calculate quality percentile for this stat
		var range_size = high - low
		var percentile: float = 50.0
		if range_size > 0.001:
			percentile = clampf((rolled - low) / range_size * 100.0, 0.0, 100.0)
		quality_sum += percentile
		stat_count += 1

		# Round appropriately
		if stat_key in DECIMAL_STATS:
			rolled_stats[stat_key] = snapped(rolled, 0.01)
		else:
			rolled_stats[stat_key] = roundi(rolled)

	var quality: int = 50
	if stat_count > 0:
		quality = roundi(quality_sum / float(stat_count))

	# Roll affixes
	var affixes: Array = _roll_affixes(rarity, quality)

	# Merge simple stat affixes into rolled_stats
	for affix in affixes:
		if affix.get("stat", false):
			var affix_id: String = affix.get("id", "")
			var affix_val = affix.get("value", 0)
			rolled_stats[affix_id] = float(rolled_stats.get(affix_id, 0)) + float(affix_val)

	var instance: Dictionary = {
		"id": item_key + "_" + str(randi()),
		"base_key": item_key,
		"name": tmpl.get("name", item_key),
		"rarity": rarity,
		"slot": tmpl.get("slot", ""),
		"range_type": tmpl.get("range_type", ""),
		"stats": rolled_stats,
		"desc": build_gear_desc(rolled_stats),
		"quality": quality,
		"affixes": affixes,
	}
	return instance


func _roll_affixes(rarity: String, quality: int) -> Array:
	## Roll affixes for a gear piece based on rarity and quality
	if _affix_config.is_empty():
		return []

	var counts: Dictionary = _affix_config.get("counts", {})
	var tier_access: Dictionary = _affix_config.get("tier_access", {})
	var pool: Array = _affix_config.get("pool", [])

	var num_affixes: int = int(counts.get(rarity, 1))
	var allowed_tiers: Array = tier_access.get(rarity, ["basic"])

	# Filter pool by allowed tiers
	var eligible: Array = []
	for affix in pool:
		if affix.get("tier", "basic") in allowed_tiers:
			eligible.append(affix)

	if eligible.is_empty():
		return []

	# Roll N unique affixes
	var chosen: Array = []
	var used_ids: Dictionary = {}
	for _i in num_affixes:
		if eligible.is_empty():
			break
		var candidates: Array = []
		for a in eligible:
			if not used_ids.has(a.get("id", "")):
				candidates.append(a)
		if candidates.is_empty():
			break

		var pick: Dictionary = candidates[randi() % candidates.size()]
		used_ids[pick.get("id", "")] = true

		# Scale value by quality
		var min_val: float = float(pick.get("min", 0))
		var max_val: float = float(pick.get("max", 0))
		var quality_factor: float = float(quality) / 100.0
		var raw_val: float = min_val + (max_val - min_val) * quality_factor * randf_range(0.9, 1.1)
		raw_val = clampf(raw_val, min_val, max_val)

		# Round: pct affixes to 0.01, int affixes to int
		var is_pct: bool = pick.get("pct", false)
		var final_val: float
		if is_pct:
			final_val = snapped(raw_val, 0.01)
		else:
			final_val = float(roundi(raw_val))

		# Compute affix percentile
		var affix_range: float = max_val - min_val
		var affix_pct: float = 50.0
		if affix_range > 0.001:
			affix_pct = clampf((final_val - min_val) / affix_range * 100.0, 0.0, 100.0)

		# Build desc string
		var desc_tmpl: String = pick.get("desc", "")
		var desc_str: String
		if is_pct:
			desc_str = desc_tmpl.replace("{v}", str(roundi(final_val * 100.0)))
		else:
			desc_str = desc_tmpl.replace("{v}", str(roundi(final_val)))

		chosen.append({
			"id": pick.get("id", ""),
			"name": pick.get("name", ""),
			"tier": pick.get("tier", "basic"),
			"stat": pick.get("stat", false),
			"value": final_val,
			"min": min_val,
			"max": max_val,
			"pct": is_pct,
			"percentile": affix_pct,
			"desc": desc_str,
		})

	return chosen


func build_gear_desc(stats: Dictionary) -> String:
	## Build a readable description string from stat dict
	var parts: Array[String] = []
	for stat_key in stats:
		var val = stats[stat_key]
		var label = STAT_LABELS.get(stat_key, stat_key)
		if stat_key in PCT_STATS:
			parts.append("+" + str(roundi(float(val) * 100.0)) + "% " + label)
		elif stat_key in DECIMAL_STATS:
			parts.append(str(snapped(float(val), 0.01)) + " " + label)
		else:
			var prefix = "+" if int(val) >= 0 else ""
			parts.append(prefix + str(int(val)) + " " + label)
	return ", ".join(parts)


func build_affix_desc(affixes: Array) -> String:
	## Build affix description lines
	var parts: Array[String] = []
	for affix in affixes:
		parts.append(str(affix.get("name", "")) + ": " + str(affix.get("desc", "")))
	return "\n".join(parts)


func get_stat_ranges(gear_instance: Dictionary) -> Dictionary:
	## Returns {stat_key: {min, max, value, percentile}} for each base stat on this gear.
	var base_key: String = gear_instance.get("base_key", "")
	var tmpl: Dictionary = _items.get(base_key, {})
	if tmpl.is_empty():
		return {}

	var rarity: String = tmpl.get("rarity", "common")
	var config: Dictionary = _rarity_roll_config.get(rarity, {"floor_pct": 0.9, "ceil_pct": 1.1})
	var floor_pct: float = float(config.get("floor_pct", 0.9))
	var ceil_pct: float = float(config.get("ceil_pct", 1.1))

	var template_stats: Dictionary = tmpl.get("stats", {})
	var rolled_stats: Dictionary = gear_instance.get("stats", {})
	var result: Dictionary = {}

	for stat_key in template_stats:
		var base_val: float = float(template_stats[stat_key])
		var low: float = base_val * floor_pct
		var high: float = base_val * ceil_pct
		# Get rolled value; affix stats may have been merged in, so use template base range
		var value: float = float(rolled_stats.get(stat_key, base_val))

		var range_size: float = high - low
		var percentile: float = 50.0
		if range_size > 0.001:
			percentile = clampf((value - low) / range_size * 100.0, 0.0, 100.0)

		if stat_key in DECIMAL_STATS:
			result[stat_key] = {
				"min": snapped(low, 0.01),
				"max": snapped(high, 0.01),
				"value": snapped(value, 0.01),
				"percentile": percentile,
			}
		else:
			result[stat_key] = {
				"min": float(roundi(low)),
				"max": float(roundi(high)),
				"value": float(roundi(value)),
				"percentile": percentile,
			}

	return result


func resolve_gear(entry) -> Dictionary:
	## Handle both legacy string keys and instance objects
	if entry == null:
		return {}
	if entry is String:
		return roll_gear_instance(entry)
	if entry is Dictionary:
		if entry.get("_legacy", false) and not entry.has("stats"):
			var rolled = roll_gear_instance(entry.get("base_key", ""))
			if not rolled.is_empty():
				return rolled
		return entry
	return {}


func get_items_by_slot(slot_name: String) -> Array[Dictionary]:
	## Get all item templates for a given equipment slot
	var result: Array[Dictionary] = []
	for key in _items:
		if _items[key].get("slot", "") == slot_name:
			var entry = _items[key].duplicate()
			entry["_key"] = key
			result.append(entry)
	return result


func get_items_by_rarity(rarity: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for key in _items:
		if _items[key].get("rarity", "") == rarity:
			var entry = _items[key].duplicate()
			entry["_key"] = key
			result.append(entry)
	return result


func roll_gear_drop(floor_num: int, clears: int) -> Dictionary:
	## Roll a random gear drop based on dungeon progress
	var rarity = _roll_drop_rarity(floor_num, clears)
	var candidates = get_items_by_rarity(rarity)
	if candidates.is_empty():
		candidates = get_items_by_rarity("common")
	if candidates.is_empty():
		return {}
	var chosen = candidates[randi() % candidates.size()]
	return roll_gear_instance(chosen["_key"])


func _roll_drop_rarity(floor_num: int, clears: int) -> String:
	var luck = float(floor_num) * 0.02 + float(clears) * 0.01
	var roll = randf()
	if roll < 0.01 + luck * 0.3:
		return "legendary"
	elif roll < 0.05 + luck * 0.5:
		return "epic"
	elif roll < 0.15 + luck * 0.7:
		return "rare"
	elif roll < 0.35 + luck:
		return "uncommon"
	else:
		return "common"


func _get_template_for_entry(entry) -> Dictionary:
	if entry is String:
		return _items.get(entry, {})
	if entry is Dictionary:
		return _items.get(entry.get("base_key", ""), {})
	return {}
