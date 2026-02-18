extends Node
## Save/load system — JSON file-based persistence with HMAC integrity.
## Save format version 6: per-slot timestamps + HMAC-SHA256 signature.

const SAVE_VERSION: int = 6
const SAVE_PATH: String = "user://save_data.json"
const SIG_PATH: String = "user://save_data.sig"
const MAX_SLOTS: int = 4
const HMAC_KEY: String = "pxl-arena-save-integ-v6-9f3a7c2d"

var _gs: Node  # GameState ref (set in _ready to avoid circular compile dep)
var _idb: Node  # ItemDatabase ref


func _ready() -> void:
	_gs = get_node("/root/GameState")
	_idb = get_node("/root/ItemDatabase")
	load_all()


# ============ SAVE / LOAD ============

func save_game() -> void:
	_sync_active_slot_to_array()
	var data: Dictionary = {
		"version": SAVE_VERSION,
		"active_slot": _gs.active_slot,
		"slots": _gs.slots.duplicate(true),
		"settings": {
			"sfx_enabled": _gs.sfx_enabled,
			"music_enabled": _gs.music_enabled,
			"auto_battle_speed": _gs.auto_battle_speed,
			"sfx_volume": _gs.sfx_volume,
			"music_volume": _gs.music_volume,
		}
	}
	var json_str := JSON.stringify(data, "\t")
	var file = FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(json_str)
		file.close()
	# Write HMAC signature of the exact bytes to a separate file
	var sig := _compute_signature(json_str)
	if not sig.is_empty():
		var sig_file = FileAccess.open(SIG_PATH, FileAccess.WRITE)
		if sig_file:
			sig_file.store_string(sig)
			sig_file.close()
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
		push_warning("Save file corrupted: not a Dictionary")
		_gs.save_tampered = true
		return

	# Verify HMAC signature against raw file bytes
	if FileAccess.file_exists(SIG_PATH):
		var sig_file = FileAccess.open(SIG_PATH, FileAccess.READ)
		if sig_file:
			var stored_sig: String = sig_file.get_as_text().strip_edges()
			sig_file.close()
			if not stored_sig.is_empty() and _compute_signature(json_str) != stored_sig:
				push_warning("Save integrity check failed — possible tampering")
				_gs.save_tampered = true

	# Validate structure
	if not _validate_save_structure(parsed):
		push_warning("Save structure validation failed")
		_gs.save_tampered = true

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


# ============ SLOT MANAGEMENT ============

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
	var now := Time.get_unix_time_from_system()

	var slot_data: Dictionary = {
		"class_key": class_key,
		"char_name": char_name,
		"created_at": now,
		"saved_at": now,
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
		"tutorial_completed": false,
		"arena_tutorial_completed": false,
	}

	# Ensure slots array is big enough
	while _gs.slots.size() <= slot_index:
		_gs.slots.append({})
	_gs.slots[slot_index] = slot_data
	_gs.active_slot = slot_index
	_load_slot_into_state(slot_index)
	save_game()


func switch_to_slot(index: int) -> void:
	## Save current slot, then load a different one.
	if index < 0 or index >= _gs.slots.size():
		return
	_sync_active_slot_to_array()
	_gs.active_slot = index
	_load_slot_into_state(index)
	# Clear transient run state when switching characters
	_gs.dg_run = {}
	_gs.ladder_run = {}
	_gs._ladder_mode = false
	_gs._tutorial_return = false
	_gs._tutorial_step = 0
	save_game()


func delete_slot(index: int) -> void:
	## Remove a character slot and adjust indices.
	if index < 0 or index >= _gs.slots.size():
		return
	_gs.slots.remove_at(index)
	if _gs.slots.is_empty():
		_gs.active_slot = 0
		_reset_live_state()
	elif _gs.active_slot == index:
		# Deleted the active slot — load the nearest remaining
		_gs.active_slot = mini(_gs.active_slot, _gs.slots.size() - 1)
		_load_slot_into_state(_gs.active_slot)
	elif _gs.active_slot > index:
		_gs.active_slot -= 1
	save_game()


func next_free_slot_index() -> int:
	## Returns the append position (slots are contiguous, no gaps).
	return _gs.slots.size()


# ============ INTERNAL STATE SYNC ============

func _sync_active_slot_to_array() -> void:
	## Write live GameState fields back into _gs.slots[active_slot].
	if _gs.active_slot < 0 or _gs.active_slot >= _gs.slots.size():
		return
	var slot: Dictionary = _gs.slots[_gs.active_slot]
	if slot.is_empty():
		return
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
	slot["tutorial_completed"] = _gs.tutorial_completed
	slot["arena_tutorial_completed"] = _gs.arena_tutorial_completed
	slot["saved_at"] = Time.get_unix_time_from_system()


func _reset_live_state() -> void:
	## Clear all GameState fields when no slots remain.
	_gs.custom_char = {}
	_gs.equipment = {}
	_gs.gear_bag.clear()
	_gs.followers.clear()
	_gs.active_follower = -1
	_gs.gold = 0
	_gs.dust = 0
	_gs.dungeon_clears = 0
	_gs.ladder_wins = 0
	_gs.arena_rating = 1000
	_gs.potions = 3
	_gs.tutorial_completed = false
	_gs.arena_tutorial_completed = false
	_gs.dg_run = {}
	_gs.ladder_run = {}


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
	_gs.tutorial_completed = slot.get("tutorial_completed", false)
	_gs.arena_tutorial_completed = slot.get("arena_tutorial_completed", false)


func _deserialize_slots(slots_data: Array) -> void:
	_gs.slots.clear()
	for slot in slots_data:
		if slot is Dictionary:
			_gs.slots.append(slot)


# ============ HMAC INTEGRITY ============

func _compute_signature(json_str: String) -> String:
	var hmac := HMACContext.new()
	if hmac.start(HashingContext.HASH_SHA256, HMAC_KEY.to_utf8_buffer()) != OK:
		return ""
	if hmac.update(json_str.to_utf8_buffer()) != OK:
		return ""
	var digest: PackedByteArray = hmac.finish()
	return digest.hex_encode()


# ============ VALIDATION ============

func _validate_save_structure(data: Dictionary) -> bool:
	if not data.has("slots") or not data.get("slots") is Array:
		return false
	var slots: Array = data["slots"]
	for slot in slots:
		if not slot is Dictionary:
			return false
		if not slot.has("class_key") or not slot.has("char_name"):
			return false
		if not slot.has("custom_char") or not slot.get("custom_char") is Dictionary:
			return false
	return true


# ============ MIGRATION ============

func _migrate(data: Dictionary, from_version: int) -> Dictionary:
	if from_version < 6:
		# v5 → v6: Add timestamps to existing slots
		var now := Time.get_unix_time_from_system()
		var slots: Array = data.get("slots", [])
		for slot in slots:
			if slot is Dictionary:
				if not slot.has("created_at"):
					slot["created_at"] = now
				if not slot.has("saved_at"):
					slot["saved_at"] = now
	data["version"] = SAVE_VERSION
	return data


# ============ CLASS DEFAULTS ============

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
