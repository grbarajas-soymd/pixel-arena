extends Node
## Save/load system — JSON file-based persistence.
## Save format version 4 (matches JS migration).

const SAVE_VERSION: int = 5
const SAVE_PATH: String = "user://save_data.json"
const MAX_SLOTS: int = 3

var _gs: Node  # GameState ref (set in _ready to avoid circular compile dep)
var _idb: Node  # ItemDatabase ref


func _ready() -> void:
	_gs = get_node("/root/GameState")
	_idb = get_node("/root/ItemDatabase")
	load_all()


func save_game() -> void:
	var data: Dictionary = {
		"version": SAVE_VERSION,
		"active_slot": _gs.active_slot,
		"slots": _serialize_slots(),
		"settings": {
			"sfx_enabled": _gs.sfx_enabled,
			"music_enabled": _gs.music_enabled,
			"auto_battle_speed": _gs.auto_battle_speed,
			"sfx_volume": _gs.sfx_volume,
			"music_volume": _gs.music_volume,
		}
	}
	var json_str = JSON.stringify(data, "\t")
	var file = FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(json_str)
		file.close()
	_upload_to_cloud_if_logged_in()


func load_all() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file = FileAccess.open(SAVE_PATH, FileAccess.READ)
	if not file:
		return
	var json_str = file.get_as_text()
	file.close()
	var parsed = JSON.parse_string(json_str)
	if not parsed is Dictionary:
		return

	var version = parsed.get("version", 1)
	if version < SAVE_VERSION:
		parsed = _migrate(parsed, version)

	_gs.active_slot = parsed.get("active_slot", 0)
	_deserialize_slots(parsed.get("slots", []))

	var settings = parsed.get("settings", {})
	_gs.sfx_enabled = settings.get("sfx_enabled", true)
	_gs.music_enabled = settings.get("music_enabled", true)
	_gs.auto_battle_speed = settings.get("auto_battle_speed", 1.0)
	_gs.sfx_volume = settings.get("sfx_volume", 0.8)
	_gs.music_volume = settings.get("music_volume", 0.8)

	# Load active slot into state
	if _gs.active_slot < _gs.slots.size():
		_load_slot_into_state(_gs.active_slot)


func create_character_slot(slot_index: int, class_key: String, char_name: String) -> void:
	var class_data = _load_json("res://data/classes.json")
	if not class_data or not class_data.has(class_key):
		push_error("Unknown class: " + class_key)
		return

	var cls = class_data[class_key]
	var starter_gear = _get_starter_loadout(class_key)

	# Roll starter gear instances
	var rolled_equip: Dictionary = {}
	for slot_name in starter_gear:
		var instance = _idb.roll_gear_instance(starter_gear[slot_name])
		if instance:
			rolled_equip[slot_name] = instance

	var default_skills: Array = _get_default_skills(class_key)
	var default_ult: int = _get_default_ultimate(class_key)

	var slot_data: Dictionary = {
		"class_key": class_key,
		"char_name": char_name,
		"custom_char": {
			"name": char_name,
			"class_key": class_key,
			"hp": cls.get("hp", 4000),
			"base_dmg": cls.get("base_dmg", 100),
			"base_as": cls.get("base_as", 0.8),
			"def": cls.get("def", 40),
			"evasion": cls.get("evasion", 0.0),
			"move_speed": cls.get("move_speed", 100),
			"skills": default_skills,
			"ultimate": default_ult,
		},
		"equipment": rolled_equip,
		"gear_bag": [],
		"followers": [],
		"active_follower": -1,
		"gold": 0,
		"dust": 0,
		"dungeon_clears": 0,
		"ladder_wins": 0,
		"arena_rating": 1000,
		"potions": 3,
	}

	# Ensure slots array is big enough
	while _gs.slots.size() <= slot_index:
		_gs.slots.append({})
	_gs.slots[slot_index] = slot_data
	_gs.active_slot = slot_index
	_load_slot_into_state(slot_index)
	save_game()


func _load_slot_into_state(index: int) -> void:
	if index >= _gs.slots.size():
		return
	var slot = _gs.slots[index]
	if slot.is_empty():
		return
	_gs.custom_char = slot.get("custom_char", {})
	_gs.equipment = slot.get("equipment", {})
	_gs.gear_bag.assign(slot.get("gear_bag", []))
	_gs.followers.assign(slot.get("followers", []))
	_gs.active_follower = slot.get("active_follower", -1)
	_gs.gold = slot.get("gold", 0)
	_gs.dust = slot.get("dust", 0)
	_gs.dungeon_clears = slot.get("dungeon_clears", 0)
	_gs.ladder_wins = slot.get("ladder_wins", 0)
	_gs.arena_rating = slot.get("arena_rating", 1000)
	_gs.potions = slot.get("potions", 3)


func _serialize_slots() -> Array:
	var result: Array = []
	for slot in _gs.slots:
		# Update active slot from live state
		if result.size() == _gs.active_slot:
			slot["custom_char"] = _gs.custom_char
			slot["equipment"] = _gs.equipment
			slot["gear_bag"] = _gs.gear_bag
			slot["followers"] = _gs.followers
			slot["active_follower"] = _gs.active_follower
			slot["gold"] = _gs.gold
			slot["dust"] = _gs.dust
			slot["dungeon_clears"] = _gs.dungeon_clears
			slot["ladder_wins"] = _gs.ladder_wins
			slot["arena_rating"] = _gs.arena_rating
			slot["potions"] = _gs.potions
		result.append(slot)
	return result


func _deserialize_slots(slots_data: Array) -> void:
	_gs.slots.clear()
	for slot in slots_data:
		if slot is Dictionary:
			_gs.slots.append(slot)


func _migrate(data: Dictionary, from_version: int) -> Dictionary:
	# Future migration logic here
	data["version"] = SAVE_VERSION
	return data


func _get_starter_loadout(class_key: String) -> Dictionary:
	match class_key:
		"wizard":
			return {"weapon": "worn_wand", "helmet": "cloth_cap", "chest": "cloth_tunic", "boots": "worn_sandals", "accessory": "copper_ring"}
		"ranger":
			return {"weapon": "wooden_bow", "helmet": "cloth_cap", "chest": "cloth_tunic", "boots": "worn_sandals", "accessory": "copper_ring"}
		"assassin":
			return {"weapon": "rusty_daggers", "helmet": "cloth_cap", "chest": "cloth_tunic", "boots": "worn_sandals", "accessory": "copper_ring"}
		"barbarian":
			return {"weapon": "rusty_blade", "helmet": "cloth_cap", "chest": "cloth_tunic", "boots": "worn_sandals", "accessory": "copper_ring"}
		_:
			return {"weapon": "rusty_blade", "helmet": "cloth_cap", "chest": "cloth_tunic", "boots": "worn_sandals", "accessory": "copper_ring"}


func _get_default_skills(class_key: String) -> Array:
	match class_key:
		"wizard": return [0, 1]       # chain_lightning, lightning_bolt
		"ranger": return [3, 4]       # hunters_mark, bloodlust
		"assassin": return [6, 7]     # shadow_step, envenom
		"barbarian": return [9, 10]   # charge, war_cry
		_: return [9, 10]


func _get_default_ultimate(class_key: String) -> int:
	match class_key:
		"wizard": return 0            # thunderstorm
		"ranger": return 1            # rain_of_fire
		"assassin": return 2          # death_mark
		"barbarian": return 3         # berserker
		_: return 3


func _load_json(path: String) -> Variant:
	var file = FileAccess.open(path, FileAccess.READ)
	if not file:
		push_error("Cannot open: " + path)
		return null
	var json_str = file.get_as_text()
	file.close()
	return JSON.parse_string(json_str)


# ============ CLOUD SAVE ============

func _upload_to_cloud_if_logged_in() -> void:
	var net := get_node_or_null("/root/Network")
	if not net or not net.is_logged_in():
		return
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file = FileAccess.open(SAVE_PATH, FileAccess.READ)
	if not file:
		return
	var json_str = file.get_as_text()
	file.close()
	var parsed = JSON.parse_string(json_str)
	if parsed is Dictionary:
		net.upload_cloud_save(parsed)


func sync_cloud_save() -> void:
	var net := get_node_or_null("/root/Network")
	if not net or not net.is_logged_in():
		return
	net.fetch_cloud_save()
	if not net.cloud_save_fetched.is_connected(_on_cloud_save_fetched):
		net.cloud_save_fetched.connect(_on_cloud_save_fetched)
	if not net.cloud_save_not_found.is_connected(_on_cloud_save_not_found):
		net.cloud_save_not_found.connect(_on_cloud_save_not_found)


func _on_cloud_save_fetched(save_data: Dictionary) -> void:
	_show_sync_dialog(save_data)


func _on_cloud_save_not_found() -> void:
	_upload_to_cloud_if_logged_in()


func _show_sync_dialog(cloud_data: Dictionary) -> void:
	var current_scene := get_tree().current_scene
	if not current_scene:
		return

	var overlay := ColorRect.new()
	overlay.color = Color(0.0, 0.0, 0.0, 0.7)
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	current_scene.add_child(overlay)

	var panel := PanelContainer.new()
	panel.position = Vector2(72, 48)
	panel.size = Vector2(240, 120)
	overlay.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 4)
	panel.add_child(vbox)

	var title := Label.new()
	title.text = "CLOUD SAVE FOUND"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 8)
	title.add_theme_color_override("font_color", Color(0.72, 0.58, 0.30))
	vbox.add_child(title)

	var cloud_slots: Array = cloud_data.get("slots", [])
	var cloud_info := Label.new()
	cloud_info.text = "Cloud: " + str(cloud_slots.size()) + " character(s)"
	cloud_info.add_theme_font_size_override("font_size", 8)
	cloud_info.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(cloud_info)

	var local_info := Label.new()
	local_info.text = "Local: " + str(_gs.slots.size()) + " character(s)"
	local_info.add_theme_font_size_override("font_size", 8)
	local_info.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(local_info)

	var btn_row := HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.add_theme_constant_override("separation", 4)
	vbox.add_child(btn_row)

	var use_cloud_btn := Button.new()
	use_cloud_btn.text = "Use Cloud"
	use_cloud_btn.add_theme_font_size_override("font_size", 8)
	use_cloud_btn.pressed.connect(func():
		_apply_cloud_save(cloud_data)
		overlay.queue_free()
	)
	btn_row.add_child(use_cloud_btn)

	var use_local_btn := Button.new()
	use_local_btn.text = "Use Local"
	use_local_btn.add_theme_font_size_override("font_size", 8)
	use_local_btn.pressed.connect(func():
		_upload_to_cloud_if_logged_in()
		overlay.queue_free()
	)
	btn_row.add_child(use_local_btn)

	var cancel_btn := Button.new()
	cancel_btn.text = "Cancel"
	cancel_btn.add_theme_font_size_override("font_size", 8)
	cancel_btn.pressed.connect(func(): overlay.queue_free())
	btn_row.add_child(cancel_btn)


func _apply_cloud_save(cloud_data: Dictionary) -> void:
	var json_str = JSON.stringify(cloud_data, "\t")
	var file = FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(json_str)
		file.close()
	load_all()
