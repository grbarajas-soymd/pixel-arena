extends Control
## Dungeon mode — roguelike room selection, combat, merchants, gear drops.
## Full port of JS dungeon.js with all 7 room types, gear drops, follower capture,
## victory/defeat, progress tracking, merchant shop, shrines, traps, etc.

# --- Pick Screen nodes ---
@onready var pick_screen: VBoxContainer = %PickScreen
@onready var pick_title: Label = %PickTitle
@onready var pick_info: Label = %PickInfo
@onready var pick_companion: VBoxContainer = %PickCompanion
@onready var descend_btn: Button = %DescendBtn
@onready var pick_back_btn: Button = %PickBackBtn

# --- Run Screen nodes ---
@onready var run_screen: VBoxContainer = %RunScreen
@onready var floor_label: Label = %FloorLabel
@onready var progress_bar: ProgressBar = %ProgressBar
@onready var stats_label: Label = %StatsLabel
@onready var hero_info: RichTextLabel = %HeroInfo
@onready var room_content: PanelContainer = %RoomContent
@onready var room_icon: Label = %RoomIcon
@onready var room_title: Label = %RoomTitle
@onready var room_desc: RichTextLabel = %RoomDesc
@onready var room_actions: HBoxContainer = %RoomActions
@onready var room_sprite: TextureRect = %RoomSprite
@onready var potion_btn: Button = %PotionBtn
@onready var abandon_btn: Button = %AbandonBtn
@onready var dg_log: RichTextLabel = %DgLog

# --- Side panels ---
@onready var left_panel: ScrollContainer = %LeftPanel
@onready var left_vbox: VBoxContainer = %LeftVBox
@onready var right_panel: ScrollContainer = %RightPanel
@onready var right_vbox: VBoxContainer = %RightVBox

var _gs: Node
var _item_db: Node
var _fdb: Node
var _selected_companion_idx: int = -1

# Gear drop SFX
var _sfx_loot_common: AudioStream = preload("res://assets/audio/sfx/5.ogg")
var _sfx_loot_rare: AudioStream = preload("res://assets/audio/sfx/7.ogg")
var _sfx_loot_epic: AudioStream = preload("res://assets/audio/sfx/9.ogg")

# Room-clear victory SFX pool — cycles sequentially to avoid repeats
var _room_clear_pool: Array[AudioStream] = [
	preload("res://assets/audio/sfx/victory-1.wav"),
	preload("res://assets/audio/sfx/victory-2.wav"),
	preload("res://assets/audio/sfx/victory-3.wav"),
]
var _room_clear_idx: int = 0

const RARITY_FLASH_COLORS: Dictionary = {
	"uncommon": Color(0.2, 0.8, 0.2, 0.15),
	"rare": Color(0.2, 0.4, 0.9, 0.2),
	"epic": Color(0.6, 0.2, 0.9, 0.25),
	"legendary": Color(1.0, 0.8, 0.1, 0.3),
	"mythic": Color(0.9, 0.1, 0.1, 0.35),
}

const ROOM_ICONS: Dictionary = {
	"combat": "Swords",
	"treasure": "Chest",
	"trap": "Warning",
	"rest": "Camp",
	"shrine": "Shrine",
	"merchant": "Shop",
	"follower_cage": "Cage",
}


func _ready() -> void:
	_gs = get_node("/root/GameState")
	_item_db = get_node("/root/ItemDatabase")
	_fdb = get_node("/root/FollowerDatabase")

	descend_btn.pressed.connect(_on_descend)
	pick_back_btn.pressed.connect(_on_pick_back)
	potion_btn.pressed.connect(_on_use_potion)
	abandon_btn.pressed.connect(_on_abandon)

	_setup_background()

	# Style all dungeon buttons with pseudo-3D look + explicit font
	var pixel_font: Font = null
	var tm := get_node_or_null("/root/ThemeManager")
	if tm:
		pixel_font = tm.pixel_font
	for btn in [potion_btn, abandon_btn, descend_btn, pick_back_btn]:
		ThemeManager.style_button(btn)
		if pixel_font:
			btn.add_theme_font_override("font", pixel_font)
		btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])

	# Explicit font overrides on all scene-defined labels for pixel-crisp rendering
	if pixel_font:
		for lbl in [pick_title, pick_info, floor_label, stats_label, room_icon, room_title]:
			lbl.add_theme_font_override("font", pixel_font)
		hero_info.add_theme_font_override("normal_font", pixel_font)
		dg_log.add_theme_font_override("normal_font", pixel_font)
		room_desc.add_theme_font_override("normal_font", pixel_font)

	# Style room content panel — dark dungeon aesthetic
	var rc_style := ThemeManager.make_inset_style(0.95)
	room_content.add_theme_stylebox_override("panel", rc_style)

	# Style dungeon log
	var log_style := ThemeManager.make_inset_style(0.9)
	dg_log.add_theme_stylebox_override("normal", log_style)

	# Style hero info panel
	var hi_style := ThemeManager.make_inset_style(0.9)
	hi_style.set_corner_radius_all(1)
	hi_style.set_content_margin_all(3)
	hero_info.add_theme_stylebox_override("normal", hi_style)

	# Style side panels
	var lp_style := ThemeManager.make_inset_style(0.9)
	lp_style.set_content_margin_all(3)
	var lp_bg := PanelContainer.new()
	lp_bg.add_theme_stylebox_override("panel", lp_style)
	lp_bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	lp_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	left_panel.add_child(lp_bg)
	left_panel.move_child(lp_bg, 0)

	var rp_style := ThemeManager.make_inset_style(0.9)
	rp_style.set_content_margin_all(3)
	var rp_bg := PanelContainer.new()
	rp_bg.add_theme_stylebox_override("panel", rp_style)
	rp_bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	rp_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	right_panel.add_child(rp_bg)
	right_panel.move_child(rp_bg, 0)

	# Check if returning from battle with active run
	if _gs.has_active_run():
		_show_run_screen()
		_handle_post_battle()
	else:
		_show_pick_screen()


func _setup_background() -> void:
	var tex = load("res://assets/tilesets/battle_backgrounds/ancient_ruins.png")
	if tex:
		var bg = TextureRect.new()
		bg.texture = tex
		bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		bg.modulate = Color(0.15, 0.15, 0.30, 1.0)
		var old_bg = $Background
		if old_bg:
			old_bg.queue_free()
		add_child(bg)
		move_child(bg, 0)


# ==================== PICK SCREEN ====================

func _show_pick_screen() -> void:
	pick_screen.visible = true
	run_screen.visible = false
	_update_pick_info()
	_update_companion_picker()

	pick_title.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	pick_title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])


func _update_pick_info() -> void:
	var c = _gs.dungeon_clears
	if c == 0:
		pick_info.text = "First descent awaits..."
	else:
		var diff_pct = c * 15
		var tier_boost = mini(2, c / 2)
		pick_info.text = "Clears: " + str(c) + " | Difficulty: +" + str(diff_pct) + "%"
		if tier_boost > 0:
			pick_info.text += " | Tier: +" + str(tier_boost)

	pick_info.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])

	if c > 0:
		descend_btn.text = "DESCEND (Endless)"
	else:
		descend_btn.text = "DESCEND"


func _update_companion_picker() -> void:
	for child in pick_companion.get_children():
		child.queue_free()

	if _gs.followers.is_empty():
		var lbl = Label.new()
		lbl.text = "No followers yet. Find some in the dungeon!"
		lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
		lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		pick_companion.add_child(lbl)
		return

	var header = Label.new()
	header.text = "Select a companion (optional):"
	header.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	pick_companion.add_child(header)

	var hbox = HBoxContainer.new()
	hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	hbox.add_theme_constant_override("separation", 4)
	pick_companion.add_child(hbox)

	for i in _gs.followers.size():
		var f = _gs.followers[i]
		var tmpl = _fdb.get_template(f.get("template_name", ""))
		var btn = Button.new()
		var name_txt = tmpl.get("name", f.get("template_name", "???"))
		var rarity = tmpl.get("rarity", "common")
		btn.text = name_txt
		btn.clip_text = true
		btn.custom_minimum_size = Vector2(110, 20)
		btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		if i == _selected_companion_idx:
			btn.add_theme_color_override("font_color", Color(0.7, 0.5, 1.0))
		else:
			var rc: String = _item_db.get_rarity_color(rarity)
			btn.add_theme_color_override("font_color", Color.from_string(rc, Color.GRAY))
		btn.pressed.connect(_on_companion_selected.bind(i))
		hbox.add_child(btn)


func _on_companion_selected(idx: int) -> void:
	if _selected_companion_idx == idx:
		_selected_companion_idx = -1
	else:
		_selected_companion_idx = idx
	_update_companion_picker()


func _on_descend() -> void:
	_gs.start_dungeon_run()

	# Bring selected companion
	if _selected_companion_idx >= 0 and _selected_companion_idx < _gs.followers.size():
		var comp = _gs.followers[_selected_companion_idx].duplicate(true)
		comp["_brought"] = true
		var run_followers: Array = _gs.dg_run.get("followers", [])
		run_followers.append(comp)
		_gs.dg_run["followers"] = run_followers
		var buff_desc = _gs.apply_follower_buff_to_run(comp)
		_gs.dg_run["deployed_follower"] = comp
		_gs.dg_log("You descend into the depths...", "info")
		_gs.dg_log(comp.get("template_name", comp.get("name", "Companion")) + " fights by your side!", "good")
		if buff_desc != "":
			_gs.dg_log("Buff: " + buff_desc, "good")
	else:
		_gs.dg_log("You descend into the depths...", "info")

	_show_run_screen()
	_generate_room()


func _on_pick_back() -> void:
	TransitionManager.fade_to_scene("res://scenes/character_forge/character_forge.tscn")


# ==================== RUN SCREEN ====================

func _show_run_screen() -> void:
	pick_screen.visible = false
	run_screen.visible = true
	_update_run_ui()
	_update_progress()
	_refresh_log()


func _update_run_ui() -> void:
	var r = _gs.dg_run
	if r.is_empty():
		return

	var hp = int(r.get("hp", 0))
	var max_hp = int(r.get("max_hp", 1))
	var hp_pct = roundi(float(hp) / float(max_hp) * 100.0)
	var hp_col = "[color=#6a9a6a]" if hp_pct > 30 else "[color=#aa5a5a]"
	var total_dmg = int(r.get("base_dmg", 0)) + int(r.get("bonus_dmg", 0))
	var total_def = int(r.get("def", 0)) + int(r.get("bonus_def", 0))
	var eva_pct = roundi(float(r.get("evasion", 0.0)) * 100.0)

	var base_as := snappedf(float(r.get("base_as", 1.0)), 0.01)
	var crit_pct := roundi(float(r.get("crit", 0.05)) * 100.0)
	var cur_mana := int(r.get("mana", 0))
	var max_mana := int(r.get("max_mana", 100))

	hero_info.clear()
	hero_info.add_text("")
	hero_info.append_text("[font_size=8]")
	hero_info.append_text("[b]" + str(r.get("hero_name", "Hero")) + "[/b]")
	hero_info.append_text("  " + hp_col + "HP:" + str(hp) + "/" + str(max_hp) + "[/color]")
	hero_info.append_text("  DMG:" + str(total_dmg))
	hero_info.append_text("  DEF:" + str(total_def))
	hero_info.append_text("  AS:" + str(base_as))
	hero_info.append_text("  EVA:" + str(eva_pct) + "%")
	if crit_pct > 5:
		hero_info.append_text("  CRT:" + str(crit_pct) + "%")
	hero_info.append_text("  [color=#4488cc]MP:" + str(cur_mana) + "/" + str(max_mana) + "[/color]")
	hero_info.append_text("  [color=#ffcc44]Gold:" + str(int(r.get("gold", 0))) + "[/color]")
	hero_info.append_text("  [color=#44aa66]Pot:" + str(int(r.get("potions", 0))) + "[/color]")
	# Show deployed companion
	var deployed_f: Dictionary = r.get("deployed_follower", {})
	if not deployed_f.is_empty():
		var comp_name: String = str(deployed_f.get("template_name", deployed_f.get("name", "Companion")))
		hero_info.append_text("\n[color=#9966cc]Companion: " + comp_name + "[/color]")
	hero_info.append_text("[/font_size]")

	potion_btn.text = "Potion (" + str(int(r.get("potions", 0))) + ")"
	potion_btn.disabled = int(r.get("potions", 0)) <= 0

	stats_label.text = "K:" + str(int(r.get("total_kills", 0))) + " G:" + str(int(r.get("gold", 0)))
	stats_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])

	_refresh_left_panel()
	_refresh_right_panel()

	floor_label.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	floor_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])


func _update_progress() -> void:
	var r = _gs.dg_run
	if r.is_empty():
		return
	var floor_num = int(r.get("floor", 1))
	var room_num = int(r.get("room", 0))
	var total_rooms = 8 * 3
	var done = (floor_num - 1) * 3 + room_num
	progress_bar.max_value = total_rooms
	progress_bar.value = done
	floor_label.text = "F" + str(floor_num) + " R" + str(room_num) + "/3"


func _refresh_log() -> void:
	dg_log.clear()
	var r = _gs.dg_run
	if r.is_empty():
		return
	var log_entries: Array = r.get("log", [])
	var start = maxi(0, log_entries.size() - 20)
	for i in range(start, log_entries.size()):
		var entry = log_entries[i]
		var color = _log_color(str(entry.get("type", "info")))
		dg_log.append_text("[font_size=8][color=" + color + "]" + str(entry.get("msg", "")) + "[/color][/font_size]\n")


func _log_color(log_type: String) -> String:
	match log_type:
		"good": return "#6a9a6a"
		"bad": return "#aa5a5a"
		"loot": return "#ffda66"
		"info": return "#9a8a6a"
		_: return "#8a7a50"


# ==================== ROOM GENERATION ====================

func _generate_room() -> void:
	var r = _gs.dg_run
	if r.is_empty() or str(r.get("state", "")) == "dead":
		return

	r["room"] = int(r.get("room", 0)) + 1

	# Floor transition
	if int(r.get("room", 0)) > 3:
		r["floor"] = int(r.get("floor", 1)) + 1
		r["room"] = 1
		_gs.dg_log("Descended to Floor " + str(int(r.get("floor", 1))) + "!", "good")
		_show_intermission(
			"FLOOR " + str(int(r.get("floor", 1))),
			ThemeManager.COLOR_HP_GREEN,
			"No rest for the weary...\nRooms: " + str(_room_history_size()) + " | Kills: " + str(int(r.get("total_kills", 0))),
			"Descend",
			_actual_generate_room
		)
		return

	_actual_generate_room()


func _actual_generate_room() -> void:
	var r = _gs.dg_run
	var room_type: String
	var room_num = int(r.get("room", 1))
	var floor_num = int(r.get("floor", 1))

	if room_num == 3:
		room_type = "combat"  # Boss room
	else:
		var types: Array[String] = ["combat", "combat", "treasure", "trap", "rest", "shrine", "follower_cage"]
		if floor_num >= 3:
			types.append("merchant")
		# No rest on floor 1
		if floor_num == 1:
			types = types.filter(func(t): return t != "rest")
		# Prevent same room type back-to-back
		var last = str(r.get("last_non_boss_room", ""))
		if last != "" and last != "combat":
			types = types.filter(func(t): return t != last)
			if types.is_empty():
				types = ["combat"]
		room_type = types[randi() % types.size()]

	# Track last non-boss room for dedup
	if room_num != 3:
		r["last_non_boss_room"] = room_type

	# Add to room history
	var history: Array = r.get("room_history", [])
	history.append({"floor": floor_num, "room": room_num, "type": room_type, "cleared": false, "name": ""})
	r["room_history"] = history

	_render_room(room_type)
	_update_progress()
	_update_run_ui()


# ==================== ROOM RENDERING ====================

func _render_room(room_type: String) -> void:
	_clear_room_actions()
	var r = _gs.dg_run
	var is_boss = int(r.get("room", 0)) == 3

	# Brief fade-in on room content for smoother transitions
	room_content.modulate.a = 0.0
	var fade_tw := create_tween()
	fade_tw.tween_property(room_content, "modulate:a", 1.0, 0.3)

	match room_type:
		"combat":
			_render_combat_room(is_boss)
		"treasure":
			_render_treasure_room()
		"trap":
			_render_trap_room()
		"rest":
			_render_rest_room()
		"shrine":
			_render_shrine_room()
		"merchant":
			_render_merchant_room()
		"follower_cage":
			_render_follower_cage()

	_update_run_ui()


func _clear_room_actions() -> void:
	for child in room_actions.get_children():
		child.queue_free()
	room_actions.size_flags_vertical = Control.SIZE_FILL


const ROOM_SPRITE_PATHS: Dictionary = {
	"treasure": "res://assets/sprites/gear/rpg_icons/I_Chest01.png",
	"trap_spike": "res://assets/sprites/gear/rpg_icons/S_Sword05.png",
	"trap_poison": "res://assets/sprites/gear/rpg_icons/S_Poison04.png",
	"trap_rocks": "res://assets/sprites/gear/rpg_icons/I_Rock03.png",
	"rest": "res://assets/sprites/gear/rpg_icons/I_Torch02.png",
	"shrine": "res://assets/sprites/gear/rpg_icons/S_Holy05.png",
	"merchant": "res://assets/sprites/gear/rpg_icons/I_GoldCoin.png",
	"cage": "res://assets/sprites/gear/rpg_icons/E_Metal03.png",
	"gear": "res://assets/sprites/gear/rpg_icons/W_Axe001.png",
	"victory": "res://assets/sprites/gear/rpg_icons/S_Buff05.png",
	"death": "res://assets/sprites/gear/rpg_icons/S_Shadow07.png",
}


func _set_room_sprite(icon_path: String, tint: Color = Color.WHITE) -> void:
	room_sprite.custom_minimum_size = Vector2(32, 32)
	var tex = load(icon_path)
	if tex:
		room_sprite.texture = tex
		room_sprite.modulate = tint
		room_sprite.visible = true
		room_icon.visible = false
	else:
		room_sprite.visible = false
		room_icon.visible = true


const BUTTON_ICONS: Dictionary = {
	"Take It": ">>", "Rest": "zZ", "Move On": ">>", "Offer Blood": "**",
	"Skip": ">>", "Equip": "E+", "Stash": "B+", "Salvage": "D+",
	"Endure": "!!", "Dodge": "<<", "Leave Shop": ">>", "Continue": ">>",
	"Return": "<<", "Return Victorious": "<<", "Descend": "vv",
	"See your loot": ">>", "See what you found": ">>",
}

func _add_room_button(text: String, callback: Callable, color: Color = Color(1, 1, 1)) -> Button:
	var btn = Button.new()
	# Add icon prefix
	var icon_text: String = BUTTON_ICONS.get(text, "")
	if icon_text != "":
		btn.text = icon_text + " " + text
	else:
		# Check prefix matches
		if text.begins_with("Keep "):
			btn.text = "K+ " + text
		elif text.begins_with("Release "):
			btn.text = "G+ " + text
		elif text.begins_with("Buy "):
			btn.text = "$+ " + text
		else:
			btn.text = text
	btn.custom_minimum_size = Vector2(120, 24)
	var pf: Font = null
	var tm_node := get_node_or_null("/root/ThemeManager")
	if tm_node:
		pf = tm_node.pixel_font
	if pf:
		btn.add_theme_font_override("font", pf)
	btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_button(btn)
	btn.pressed.connect(callback)
	room_actions.add_child(btn)
	return btn


# ==================== COMBAT ROOM ====================

func _render_combat_room(is_boss: bool) -> void:
	var r = _gs.dg_run
	var clears = _gs.dungeon_clears
	var tier_boost = mini(2, clears / 2)
	var floor_num = int(r.get("floor", 1))
	var tier = mini(4, ceili(float(floor_num) / 2.0) + tier_boost)

	# Pick monster from JSON
	var monster = _pick_dungeon_monster(tier)
	var clear_scale = 1.0 + float(clears) * 0.15
	var scale = (1.0 + float(floor_num - 1) * 0.18) * clear_scale
	monster["hp"] = roundi(float(monster.get("hp", 500)) * scale)
	monster["dmg"] = roundi(float(monster.get("dmg", 50)) * scale)
	monster["def"] = roundi(float(monster.get("def", 10)) * scale)

	if is_boss:
		monster["hp"] = roundi(float(monster.get("hp", 500)) * 1.8)
		monster["dmg"] = roundi(float(monster.get("dmg", 50)) * 1.4)
		monster["def"] = roundi(float(monster.get("def", 10)) * 1.3)
		monster["name"] = "* " + str(monster.get("name", "Monster")) + " *"

	monster["max_hp"] = monster.get("hp", 500)
	r["combat_enemy"] = monster
	r["combat_turn"] = 0
	r["last_combat_stats"] = {
		"turns": 0,
		"dmg_dealt": 0,
		"dmg_taken": 0,
		"hp_before": int(r.get("hp", 0)),
		"monster_name": monster.get("name", "Monster"),
		"monster_icon": monster.get("icon", ""),
	}

	# Transition to turn-based dungeon battle scene
	TransitionManager.fade_to_scene("res://scenes/dungeon_battle/dungeon_battle.tscn")


func _pick_dungeon_monster(max_tier: int) -> Dictionary:
	var file = FileAccess.open("res://data/monsters.json", FileAccess.READ)
	if not file:
		return {"name": "Slime", "hp": 260, "dmg": 25, "def": 5, "tier": 1, "specials": []}
	var monsters = JSON.parse_string(file.get_as_text())
	file.close()
	if not monsters is Array or monsters.is_empty():
		return {"name": "Slime", "hp": 260, "dmg": 25, "def": 5, "tier": 1, "specials": []}

	var candidates: Array = []
	for m in monsters:
		if int(m.get("tier", 1)) <= max_tier:
			candidates.append(m.duplicate(true))
	if candidates.is_empty():
		candidates.append({"name": "Slime", "hp": 260, "dmg": 25, "def": 5, "tier": 1, "specials": []})
	return candidates[randi() % candidates.size()]


# ==================== TREASURE ROOM ====================

func _render_treasure_room() -> void:
	var r = _gs.dg_run
	var floor_num = int(r.get("floor", 1))
	var treasure_scale = 1.0 + float(_gs.dungeon_clears) * 0.1
	var gold_amount = roundi((5.0 + randf() * 10.0) * float(floor_num) * treasure_scale)

	# Roll for run item (60% chance)
	var run_item: Dictionary = {}
	if randf() > 0.4:
		run_item = _roll_run_item()

	# 50% chance of gear
	var treasure_gear: Dictionary = {}
	if randf() < 0.5:
		treasure_gear = _item_db.roll_gear_drop(floor_num, _gs.dungeon_clears)

	_set_room_sprite(ROOM_SPRITE_PATHS["treasure"], ThemeManager.COLOR_GOLD_BRIGHT)
	room_title.text = "Treasure!"
	room_title.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	room_title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])

	room_desc.clear()
	room_desc.append_text("[font_size=8]You found a chest containing [color=#ffcc44]" + str(gold_amount) + " gold[/color]!")
	if not run_item.is_empty():
		room_desc.append_text("\nInside: [color=#ffcc44]" + str(run_item.get("name", "Item")) + "[/color] - " + str(run_item.get("desc", "")))
	if not treasure_gear.is_empty():
		var tmpl = _item_db.get_template(treasure_gear.get("base_key", ""))
		if not tmpl.is_empty():
			var col = _item_db.get_rarity_color(tmpl.get("rarity", "common"))
			room_desc.append_text("\nGear: [color=" + col + "]" + str(tmpl.get("name", "Item")) + "[/color]")
	room_desc.append_text("[/font_size]")

	r["_pending_treasure_gold"] = gold_amount
	r["pending_item"] = run_item
	r["pending_treasure_gear"] = treasure_gear

	_add_room_button("Take It", _on_take_treasure)


func _on_take_treasure() -> void:
	var r = _gs.dg_run
	var gold_amount = int(r.get("_pending_treasure_gold", 0))
	r["gold"] = int(r.get("gold", 0)) + gold_amount
	_gs.dg_log("Gained " + str(gold_amount) + " gold!", "loot")
	_mark_room_cleared()

	var item: Dictionary = r.get("pending_item", {})
	if not item.is_empty():
		_apply_run_item(item)
		var items: Array = r.get("items", [])
		items.append({"name": item.get("name", ""), "desc": item.get("desc", "")})
		r["items"] = items
		_gs.dg_log("Got " + str(item.get("name", "Item")) + "! " + str(item.get("desc", "")), "loot")
		r["pending_item"] = {}

	var gear: Dictionary = r.get("pending_treasure_gear", {})
	if not gear.is_empty():
		r["pending_treasure_gear"] = {}
		_show_gear_drop(gear)
		return

	_update_run_ui()
	_delayed_generate_room()


# ==================== TRAP ROOM ====================

func _render_trap_room() -> void:
	var r = _gs.dg_run
	var floor_num = int(r.get("floor", 1))
	var trap_scale = 1.0 + float(_gs.dungeon_clears) * 0.1

	var traps = [
		{"name": "Spike Trap", "desc": "Sharp spikes spring from the floor!", "dmg": roundi((150.0 + float(floor_num) * 50.0) * trap_scale)},
		{"name": "Poison Gas", "desc": "Toxic fumes fill the chamber!", "dmg": roundi((250.0 + float(floor_num) * 60.0) * trap_scale)},
		{"name": "Falling Rocks", "desc": "The ceiling collapses!", "dmg": roundi((180.0 + float(floor_num) * 45.0) * trap_scale)},
	]
	var trap = traps[randi() % traps.size()]
	var can_dodge = float(r.get("evasion", 0.0)) > 0.0
	var dodge_chance = roundi(float(r.get("evasion", 0.0)) * 100.0 + 20.0)

	# Pick trap-specific icon
	var trap_icon_key: String = "trap_spike"
	if str(trap["name"]).find("Poison") >= 0:
		trap_icon_key = "trap_poison"
	elif str(trap["name"]).find("Rock") >= 0:
		trap_icon_key = "trap_rocks"
	_set_room_sprite(ROOM_SPRITE_PATHS[trap_icon_key], ThemeManager.COLOR_HP_RED)
	room_title.text = str(trap["name"]) + "!"
	room_title.add_theme_color_override("font_color", ThemeManager.COLOR_HP_RED)
	room_title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])

	room_desc.clear()
	room_desc.append_text("[font_size=8]" + str(trap["desc"]) + "\nPotential damage: [color=#aa5a5a]" + str(trap["dmg"]) + "[/color][/font_size]")

	r["_pending_trap_dmg"] = int(trap["dmg"])

	_add_room_button("Endure (" + str(trap["dmg"]) + ")", _on_trigger_trap)
	if can_dodge:
		_add_room_button("Dodge (" + str(dodge_chance) + "%)", _on_dodge_trap)


func _on_trigger_trap() -> void:
	var r = _gs.dg_run
	var dmg = int(r.get("_pending_trap_dmg", 0))
	var total_def = int(r.get("def", 0)) + int(r.get("bonus_def", 0))
	var reduced = roundi(float(dmg) * (1.0 - minf(float(total_def) / 300.0, 0.7)))
	r["hp"] = int(r.get("hp", 0)) - reduced
	_gs.dg_log("Took " + str(reduced) + " trap damage!", "bad")
	_mark_room_cleared()
	_update_run_ui()
	if int(r.get("hp", 0)) <= 0:
		r["hp"] = 0
		_show_death()
		return
	_delayed_generate_room()


func _on_dodge_trap() -> void:
	var r = _gs.dg_run
	var eva = float(r.get("evasion", 0.0))
	var chance = eva + 0.2
	if randf() < chance:
		_gs.dg_log("Dodged the trap!", "good")
		_mark_room_cleared()
		_delayed_generate_room()
	else:
		_gs.dg_log("Partially dodged! Half damage.", "bad")
		var dmg = int(r.get("_pending_trap_dmg", 0))
		r["_pending_trap_dmg"] = roundi(float(dmg) * 0.5)
		_on_trigger_trap()


# ==================== REST ROOM ====================

func _render_rest_room() -> void:
	var r = _gs.dg_run
	var heal_amt = roundi(float(int(r.get("max_hp", 1))) * 0.25)

	_set_room_sprite(ROOM_SPRITE_PATHS["rest"], Color(1.0, 0.7, 0.3))
	room_title.text = "Rest Site"
	room_title.add_theme_color_override("font_color", ThemeManager.COLOR_HP_GREEN)
	room_title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])

	room_desc.clear()
	room_desc.append_text("[font_size=8]A safe place to rest and recover.\nHeal: [color=#6a9a6a]" + str(heal_amt) + " HP[/color][/font_size]")

	r["_pending_heal"] = heal_amt

	_add_room_button("Rest", _on_rest)
	_add_room_button("Move On", func(): _mark_room_cleared(); _generate_room())


func _on_rest() -> void:
	var r = _gs.dg_run
	var heal = int(r.get("_pending_heal", 0))
	r["hp"] = mini(int(r.get("max_hp", 1)), int(r.get("hp", 0)) + heal)
	_gs.dg_log("Rested and healed " + str(heal) + " HP.", "good")
	_mark_room_cleared()
	_update_run_ui()
	_delayed_generate_room()


# ==================== SHRINE ROOM ====================

func _render_shrine_room() -> void:
	var r = _gs.dg_run
	var shrines = [
		{"name": "Shrine of Power", "desc": "+35 DMG permanently", "key": "bonus_dmg", "value": 35},
		{"name": "Shrine of Vitality", "desc": "+500 Max HP", "key": "hp_bonus", "value": 500},
		{"name": "Shrine of Iron", "desc": "+25 DEF permanently", "key": "bonus_def", "value": 25},
		{"name": "Shrine of Shadows", "desc": "+8% Evasion", "key": "evasion", "value": 0.08},
		{"name": "Shrine of Fury", "desc": "+0.2 AtkSpd", "key": "base_as", "value": 0.2},
	]
	var shrine = shrines[randi() % shrines.size()]
	var cost = roundi(float(int(r.get("max_hp", 1))) * 0.15)

	_set_room_sprite(ROOM_SPRITE_PATHS["shrine"], Color(0.6, 0.4, 0.8))
	room_title.text = str(shrine["name"])
	room_title.add_theme_color_override("font_color", Color(0.6, 0.4, 0.8))
	room_title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])

	room_desc.clear()
	room_desc.append_text("[font_size=8]" + str(shrine["desc"]) + "\nCost: [color=#aa5a5a]" + str(cost) + " HP[/color] (blood offering)[/font_size]")

	r["_pending_shrine"] = shrine
	r["_pending_shrine_cost"] = cost

	var use_btn = _add_room_button("Offer Blood", _on_use_shrine)
	use_btn.disabled = int(r.get("hp", 0)) <= cost
	_add_room_button("Skip", func(): _mark_room_cleared(); _generate_room())


func _on_use_shrine() -> void:
	var r = _gs.dg_run
	var cost = int(r.get("_pending_shrine_cost", 0))
	if int(r.get("hp", 0)) <= cost:
		return
	r["hp"] = int(r.get("hp", 0)) - cost

	var shrine = r.get("_pending_shrine", {})
	if not shrine.is_empty():
		var key = str(shrine.get("key", ""))
		var val = shrine.get("value", 0)
		match key:
			"bonus_dmg":
				r["bonus_dmg"] = int(r.get("bonus_dmg", 0)) + int(val)
			"bonus_def":
				r["bonus_def"] = int(r.get("bonus_def", 0)) + int(val)
			"hp_bonus":
				r["max_hp"] = int(r.get("max_hp", 0)) + int(val)
				r["hp"] = int(r.get("hp", 0)) + int(val)
				r["bonus_hp"] = int(r.get("bonus_hp", 0)) + int(val)
			"evasion":
				r["evasion"] = minf(0.5, float(r.get("evasion", 0.0)) + float(val))
			"base_as":
				r["base_as"] = float(r.get("base_as", 0.0)) + float(val)

		_gs.dg_log("Shrine blessing: " + str(shrine.get("desc", "")), "loot")
		var items: Array = r.get("items", [])
		items.append({"name": shrine.get("name", "Shrine"), "desc": shrine.get("desc", "")})
		r["items"] = items
		r["_pending_shrine"] = {}

	_mark_room_cleared()
	_update_run_ui()
	_delayed_generate_room()


# ==================== MERCHANT ROOM ====================

func _render_merchant_room() -> void:
	var r = _gs.dg_run
	var floor_num = int(r.get("floor", 1))

	var all_shop_items: Array = [
		{"name": "Health Potion", "cost": 20, "desc": "+1 Potion", "key": "potion"},
		{"name": "Damage Tome", "cost": 40, "desc": "+30 DMG", "key": "bonus_dmg", "value": 30},
		{"name": "Shield Scroll", "cost": 35, "desc": "+20 DEF", "key": "bonus_def", "value": 20},
		{"name": "Healing Salve", "cost": 25, "desc": "Heal 40% HP", "key": "heal_pct", "value": 0.4},
		{"name": "Speed Scroll", "cost": 30, "desc": "+0.15 AS", "key": "base_as", "value": 0.15},
		{"name": "War Crystal", "cost": 35, "desc": "+500 HP", "key": "hp_bonus", "value": 500},
	]
	# Pick 3 random consumables (always include potion + 2 random others)
	var shop_items: Array = [all_shop_items[0]]  # Always offer potion
	var others: Array = all_shop_items.slice(1)
	others.shuffle()
	shop_items.append(others[0])
	shop_items.append(others[1])

	# Roll 2 gear items
	var gear_for_sale: Array = []
	var gear_prices: Dictionary = {"common": 20, "uncommon": 40, "rare": 70, "epic": 120, "legendary": 250}
	var num_gear = 2
	for _i in num_gear:
		var shop_gear = _item_db.roll_gear_drop(floor_num, _gs.dungeon_clears)
		if shop_gear.is_empty():
			continue
		var tmpl = _item_db.get_template(shop_gear.get("base_key", ""))
		if tmpl.is_empty():
			continue
		var price = int(gear_prices.get(tmpl.get("rarity", "common"), 40))
		gear_for_sale.append({"gear": shop_gear, "tmpl_key": shop_gear.get("base_key", ""), "price": price})

	r["shop_items"] = shop_items
	r["shop_gear"] = gear_for_sale

	_refresh_merchant()


func _refresh_merchant() -> void:
	var r = _gs.dg_run
	_clear_room_actions()

	_set_room_sprite(ROOM_SPRITE_PATHS["merchant"], ThemeManager.COLOR_ACCENT_TEAL)
	room_title.text = "Wandering Merchant"
	room_title.add_theme_color_override("font_color", ThemeManager.COLOR_ACCENT_TEAL)
	room_title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])

	room_desc.clear()
	room_desc.append_text("[font_size=8][color=#ffcc44]Gold: " + str(int(r.get("gold", 0))) + "[/color][/font_size]")

	# Build buy buttons in a ScrollContainer so they don't overflow the screen
	var scroll = ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.custom_minimum_size = Vector2(170, 130)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	room_actions.size_flags_vertical = Control.SIZE_EXPAND_FILL
	room_actions.add_child(scroll)

	var buy_vbox = VBoxContainer.new()
	buy_vbox.add_theme_constant_override("separation", 2)
	buy_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(buy_vbox)

	var pf: Font = null
	var tm_node := get_node_or_null("/root/ThemeManager")
	if tm_node:
		pf = tm_node.pixel_font

	var shop_items: Array = r.get("shop_items", [])
	for i in shop_items.size():
		var it = shop_items[i]
		var btn = Button.new()
		btn.text = str(it.get("name", "")) + " - " + str(it.get("desc", "")) + " (" + str(it.get("cost", 0)) + "g)"
		btn.clip_text = true
		btn.custom_minimum_size = Vector2(160, 16)
		if pf:
			btn.add_theme_font_override("font", pf)
		btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		btn.disabled = int(r.get("gold", 0)) < int(it.get("cost", 999))
		btn.pressed.connect(_on_buy_item.bind(i))
		buy_vbox.add_child(btn)

	var shop_gear: Array = r.get("shop_gear", [])
	for i in shop_gear.size():
		var g = shop_gear[i]
		var tmpl = _item_db.get_template(str(g.get("tmpl_key", "")))
		var btn = Button.new()
		btn.text = str(tmpl.get("name", "Gear")) + " (" + str(tmpl.get("slot", "")) + ") " + str(g.get("price", 0)) + "g"
		btn.clip_text = true
		btn.custom_minimum_size = Vector2(160, 16)
		if pf:
			btn.add_theme_font_override("font", pf)
		btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		var rarity_c: String = _item_db.get_rarity_color(tmpl.get("rarity", "common"))
		btn.add_theme_color_override("font_color", Color.from_string(rarity_c, Color.GRAY))
		btn.disabled = int(r.get("gold", 0)) < int(g.get("price", 999))
		btn.pressed.connect(_on_buy_gear.bind(i))
		buy_vbox.add_child(btn)

	var leave_btn = Button.new()
	leave_btn.text = "Leave Shop"
	leave_btn.custom_minimum_size = Vector2(80, 20)
	if pf:
		leave_btn.add_theme_font_override("font", pf)
	leave_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	leave_btn.pressed.connect(func(): _mark_room_cleared(); _generate_room())
	buy_vbox.add_child(leave_btn)


func _on_buy_item(idx: int) -> void:
	var r = _gs.dg_run
	var shop_items: Array = r.get("shop_items", [])
	if idx < 0 or idx >= shop_items.size():
		return
	var it = shop_items[idx]
	var cost = int(it.get("cost", 999))
	if int(r.get("gold", 0)) < cost:
		return

	r["gold"] = int(r.get("gold", 0)) - cost
	_apply_shop_item(it)
	_gs.dg_log("Bought " + str(it.get("name", "")) + "! " + str(it.get("desc", "")), "loot")
	var items: Array = r.get("items", [])
	items.append({"name": it.get("name", ""), "desc": it.get("desc", "")})
	r["items"] = items
	_refresh_merchant()
	_update_run_ui()


func _on_buy_gear(idx: int) -> void:
	var r = _gs.dg_run
	var shop_gear: Array = r.get("shop_gear", [])
	if idx < 0 or idx >= shop_gear.size():
		return
	var g = shop_gear[idx]
	var price = int(g.get("price", 999))
	if int(r.get("gold", 0)) < price:
		return

	r["gold"] = int(r.get("gold", 0)) - price
	_gs.dg_log("Bought gear!", "loot")
	shop_gear.remove_at(idx)
	r["shop_gear"] = shop_gear
	_update_run_ui()
	_show_gear_drop(g.get("gear", {}), _refresh_merchant)


func _apply_shop_item(it: Dictionary) -> void:
	var r = _gs.dg_run
	var key = str(it.get("key", ""))
	var val = it.get("value", 0)
	match key:
		"potion":
			r["potions"] = mini(int(r.get("max_potions", 3)), int(r.get("potions", 0)) + 1)
		"bonus_dmg":
			r["bonus_dmg"] = int(r.get("bonus_dmg", 0)) + int(val)
		"bonus_def":
			r["bonus_def"] = int(r.get("bonus_def", 0)) + int(val)
		"heal_pct":
			r["hp"] = mini(int(r.get("max_hp", 1)), int(r.get("hp", 0)) + roundi(float(int(r.get("max_hp", 1))) * float(val)))
		"base_as":
			r["base_as"] = float(r.get("base_as", 0.0)) + float(val)
		"hp_bonus":
			r["max_hp"] = int(r.get("max_hp", 0)) + int(val)
			r["hp"] = int(r.get("hp", 0)) + int(val)
			r["bonus_hp"] = int(r.get("bonus_hp", 0)) + int(val)


# ==================== FOLLOWER CAGE ====================

func _render_follower_cage() -> void:
	var r = _gs.dg_run
	var floor_num = int(r.get("floor", 1))

	# Roll a random follower
	var follower = _roll_cage_follower(floor_num)
	_mark_room_cleared_with_name("Cage: " + str(follower.get("template_name", follower.get("name", "???"))))
	_show_follower_capture(follower)


func _roll_cage_follower(floor_num: int) -> Dictionary:
	# Roll rarity based on floor
	var rarity: String
	var roll = randf()
	if floor_num >= 6 and roll < 0.1:
		rarity = "legendary"
	elif floor_num >= 4 and roll < 0.2:
		rarity = "epic"
	elif floor_num >= 2 and roll < 0.4:
		rarity = "rare"
	elif roll < 0.65:
		rarity = "uncommon"
	else:
		rarity = "common"

	var candidates = _fdb.get_templates_by_rarity(rarity)
	if candidates.is_empty():
		candidates = _fdb.get_templates_by_rarity("common")
	if candidates.is_empty():
		return {"template_name": "Unknown", "rarity": "common"}

	var chosen = candidates[randi() % candidates.size()]
	var instance: Dictionary = {
		"template_name": chosen.get("name", "Unknown"),
		"rarity": chosen.get("rarity", "common"),
		"upgrades": 0,
		"combat_hp": int(chosen.get("combat_hp", 400)),
		"combat_dmg": int(chosen.get("combat_dmg", 30)),
		"combat_as": float(chosen.get("combat_as", 1.0)),
		"combat_def": int(chosen.get("combat_def", 10)),
		"combat_range": int(chosen.get("combat_range", 60)),
	}
	return instance


func _show_follower_capture(f: Dictionary, after_fn: Callable = Callable()) -> void:
	var r = _gs.dg_run
	var tmpl = _fdb.get_template(f.get("template_name", ""))
	var rarity = f.get("rarity", tmpl.get("rarity", "common"))
	var rarity_col = _fdb.get_rarity_color(rarity)
	var sell_price = {"common": 15, "uncommon": 30, "rare": 60, "epic": 120, "legendary": 250}.get(rarity, 20)

	r["pending_capture_follower"] = f
	r["pending_capture_sell_price"] = sell_price
	r["_pending_capture_after"] = {} # Can't store callables, use flag

	_clear_room_actions()
	# Show the actual follower sprite instead of generic cage icon
	var f_sprite_name: String = str(f.get("template_name", "")).to_lower().replace(" ", "_")
	var f_sprite_path := "res://assets/sprites/generated/followers/" + f_sprite_name + ".png"
	var f_tex = load(f_sprite_path)
	if f_tex:
		room_sprite.texture = f_tex
		room_sprite.modulate = Color(0.7, 0.5, 1.0)
		room_sprite.visible = true
		room_icon.visible = false
	else:
		_set_room_sprite(ROOM_SPRITE_PATHS["cage"], Color(0.7, 0.5, 1.0))
	room_title.text = "FOLLOWER CAPTURED!"
	room_title.add_theme_color_override("font_color", Color(0.7, 0.5, 1.0))
	room_title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])

	var fname = tmpl.get("name", f.get("template_name", "???"))
	var buff_desc = tmpl.get("buff_desc", "")
	var ability = tmpl.get("ability_name", "")
	var ability_desc_txt = tmpl.get("ability_desc", "")

	room_desc.clear()
	room_desc.append_text("[font_size=8]")
	room_desc.append_text("[color=" + rarity_col + "][b]" + fname + "[/b] (" + rarity + ")[/color]\n")
	if buff_desc != "":
		room_desc.append_text("Buff: " + buff_desc + "\n")
	if ability != "":
		room_desc.append_text("Ability: [b]" + ability + "[/b] - " + ability_desc_txt + "\n")
	room_desc.append_text("Combat: " + str(f.get("combat_hp", 0)) + "HP / " + str(f.get("combat_dmg", 0)) + "DMG / " + str(f.get("combat_def", 0)) + "DEF")
	room_desc.append_text("[/font_size]")

	# Store after_fn for use after capture decision
	if after_fn.is_valid():
		# We can't easily store callables in dicts, so use a pattern
		_add_room_button("Keep " + fname, func(): _on_keep_follower(after_fn))
		_add_room_button("Release (" + str(sell_price) + "g)", func(): _on_sell_follower(after_fn))
	else:
		_add_room_button("Keep " + fname, func(): _on_keep_follower(Callable()))
		_add_room_button("Release (" + str(sell_price) + "g)", func(): _on_sell_follower(Callable()))

	_update_run_ui()


func _on_keep_follower(after_fn: Callable) -> void:
	var r = _gs.dg_run
	var f: Dictionary = r.get("pending_capture_follower", {})
	if f.is_empty():
		return

	var run_followers: Array = r.get("followers", [])
	run_followers.append(f)
	r["followers"] = run_followers
	_gs.dg_log("Kept " + str(f.get("template_name", "follower")) + "! (" + str(f.get("rarity", "")) + ")", "loot")

	# Apply passive buff
	var buff_desc = _gs.apply_follower_buff_to_run(f)
	if buff_desc != "":
		_gs.dg_log("Buff: " + buff_desc, "good")

	# Auto-deploy first follower
	var deployed: Dictionary = r.get("deployed_follower", {})
	if deployed.is_empty():
		r["deployed_follower"] = f
		_gs.dg_log("Auto-deployed " + str(f.get("template_name", "")) + " as combat companion!", "good")

	r["pending_capture_follower"] = {}
	_update_run_ui()
	if after_fn.is_valid():
		after_fn.call()
	else:
		_delayed_generate_room()


func _on_sell_follower(after_fn: Callable) -> void:
	var r = _gs.dg_run
	var f: Dictionary = r.get("pending_capture_follower", {})
	var price = int(r.get("pending_capture_sell_price", 20))
	r["gold"] = int(r.get("gold", 0)) + price
	_gs.dg_log("Released " + str(f.get("template_name", "follower")) + " for " + str(price) + "g.", "loot")
	r["pending_capture_follower"] = {}
	_update_run_ui()
	if after_fn.is_valid():
		after_fn.call()
	else:
		_delayed_generate_room()


# ==================== GEAR DROP ====================

func _show_gear_drop(gear: Dictionary, after_fn: Callable = Callable()) -> void:
	var r = _gs.dg_run
	if gear.is_empty():
		if after_fn.is_valid():
			after_fn.call()
		else:
			_delayed_generate_room()
		return

	var tmpl = _item_db.get_template(gear.get("base_key", ""))
	if tmpl.is_empty():
		if after_fn.is_valid():
			after_fn.call()
		else:
			_delayed_generate_room()
		return

	r["pending_gear_drop"] = gear
	var rarity = tmpl.get("rarity", "common")
	var rarity_col = _item_db.get_rarity_color(rarity)
	var dust_val = _item_db.get_salvage_value(gear)
	var quality = int(gear.get("quality", 50))

	# Gear drop SFX + screen flash
	_play_gear_drop_effects(rarity)

	_clear_room_actions()
	# Show the actual item icon — much bigger for gear drops
	room_sprite.custom_minimum_size = Vector2(64, 64)
	var item_tex: Texture2D = IconMap.get_item_icon(gear.get("base_key", ""))
	var rarity_tint: Color = ThemeManager.RARITY_COLORS.get(rarity, ThemeManager.COLOR_GOLD_BRIGHT).lightened(0.4)
	if item_tex:
		room_sprite.texture = item_tex
		room_sprite.modulate = rarity_tint
		room_sprite.visible = true
		room_icon.visible = false
	else:
		room_sprite.custom_minimum_size = Vector2(64, 64)
		_set_room_sprite(ROOM_SPRITE_PATHS["gear"], rarity_tint)
		room_sprite.custom_minimum_size = Vector2(64, 64)

	var is_boss: bool = int(r.get("room", 0)) == 3
	room_title.text = "BOSS LOOT!" if is_boss else "GEAR DROP!"
	var title_col: Color = ThemeManager.RARITY_COLORS.get(rarity, ThemeManager.COLOR_GOLD_BRIGHT)
	room_title.add_theme_color_override("font_color", title_col)
	room_title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])

	room_desc.clear()
	room_desc.append_text("[font_size=8]")
	room_desc.append_text("[color=" + rarity_col + "][b]" + str(tmpl.get("name", "Item")) + "[/b] (" + rarity.to_upper() + ")[/color]\n")

	# Quality badge with percentage
	var q_col: String = "#888888"
	var q_text: String = ""
	if quality >= 95:
		q_col = "#ffd700"
		q_text = "Perfect"
	elif quality >= 80:
		q_col = "#44ff88"
		q_text = "Excellent"
	elif quality >= 60:
		q_col = "#44ddbb"
		q_text = "Good"
	elif quality >= 40:
		q_col = "#ffffff"
		q_text = "Average"
	else:
		q_col = "#888888"
		q_text = "Poor"
	room_desc.append_text("[color=" + q_col + "]" + str(quality) + "% " + q_text + "[/color]  " + str(tmpl.get("slot", "")) + "\n")

	# Stat rows with min/max ranges and percentile colors
	var stat_ranges: Dictionary = _item_db.get_stat_ranges(gear)
	var rolled_stats: Dictionary = gear.get("stats", {})
	for stat_key in rolled_stats:
		var val = rolled_stats[stat_key]
		var label: String = _item_db.STAT_LABELS.get(stat_key, stat_key)
		var val_str: String = _format_gear_stat(stat_key, val)

		var pct: float = 50.0
		var range_str: String = ""
		if stat_ranges.has(stat_key):
			var sr: Dictionary = stat_ranges[stat_key]
			pct = float(sr.get("percentile", 50.0))
			var min_s: String = _format_gear_stat(stat_key, sr.get("min", 0))
			var max_s: String = _format_gear_stat(stat_key, sr.get("max", 0))
			range_str = " [color=#666666][" + min_s + "-" + max_s + "][/color]"

		# Color by percentile
		var stat_col: String = "#888888"
		if pct >= 90.0:
			stat_col = "#ffd700"
		elif pct >= 70.0:
			stat_col = "#44ff88"
		elif pct >= 40.0:
			stat_col = "#ffffff"
		room_desc.append_text("[color=#999999]" + label + ":[/color] [color=" + stat_col + "]" + val_str + "[/color]" + range_str + "\n")

	# Affix section
	var affixes: Array = gear.get("affixes", [])
	if not affixes.is_empty():
		room_desc.append_text("[color=#ffd700]Affixes:[/color]\n")
		for affix in affixes:
			var a_name: String = str(affix.get("name", ""))
			var a_desc: String = str(affix.get("desc", ""))
			var a_pct: float = float(affix.get("percentile", 50.0))
			var a_col: String = "#ffffff"
			if a_pct >= 90.0:
				a_col = "#ffd700"
			elif a_pct >= 70.0:
				a_col = "#44ff88"
			elif a_pct < 40.0:
				a_col = "#888888"
			var a_range: String = ""
			if affix.has("min") and affix.has("max"):
				var a_min_s: String = str(roundi(float(affix["min"]) * 100.0)) + "%" if affix.get("pct", false) else str(roundi(float(affix["min"])))
				var a_max_s: String = str(roundi(float(affix["max"]) * 100.0)) + "%" if affix.get("pct", false) else str(roundi(float(affix["max"])))
				a_range = " [color=#666666][" + a_min_s + "-" + a_max_s + "][/color]"
			room_desc.append_text(" [color=" + a_col + "]" + a_name + ": " + a_desc + "[/color]" + a_range + "\n")

	# Compare to equipped
	var slot = str(tmpl.get("slot", ""))
	var current_equip = _gs.equipment.get(slot, {})
	if not current_equip.is_empty():
		var cur_tmpl = _item_db.get_template(current_equip.get("base_key", ""))
		if not cur_tmpl.is_empty():
			var cur_col = _item_db.get_rarity_color(cur_tmpl.get("rarity", "common"))
			var drop_stats: Dictionary = gear.get("stats", {})
			var cur_stats: Dictionary = current_equip.get("stats", {})
			var diffs: Array[String] = []
			var all_keys: Dictionary = {}
			for k in drop_stats:
				all_keys[k] = true
			for k in cur_stats:
				all_keys[k] = true
			for k in all_keys:
				var new_val = float(drop_stats.get(k, 0))
				var cur_val = float(cur_stats.get(k, 0))
				var diff = new_val - cur_val
				if absf(diff) > 0.001:
					var dl = _item_db.STAT_LABELS.get(k, k)
					if diff > 0:
						diffs.append("[color=#44ff88]+" + str(snapped(diff, 0.01)) + " " + dl + "[/color]")
					else:
						diffs.append("[color=#ff4444]" + str(snapped(diff, 0.01)) + " " + dl + "[/color]")
			room_desc.append_text("vs [color=" + cur_col + "]" + str(cur_tmpl.get("name", "")) + "[/color]: ")
			if not diffs.is_empty():
				room_desc.append_text(", ".join(diffs))
			else:
				room_desc.append_text("[color=#888888]no change[/color]")
			room_desc.append_text("\n")
	else:
		room_desc.append_text("[color=#44ff88]Empty " + slot + " slot[/color]\n")

	room_desc.append_text("[/font_size]")

	_add_room_button("Equip", func(): _on_equip_gear(after_fn))
	_add_room_button("Stash", func(): _on_stash_gear(after_fn))
	if dust_val > 0:
		_add_room_button("Salvage (" + str(dust_val) + ")", func(): _on_salvage_gear(after_fn))

	# Dio reacts to extreme quality rolls
	if quality >= 95 or quality <= 10:
		get_tree().create_timer(0.6).timeout.connect(func():
			var ctx := "perfect_gear" if quality >= 95 else "trash_gear"
			DioPopup.spawn(self, ctx, quality)
		)


func _on_equip_gear(after_fn: Callable) -> void:
	var r = _gs.dg_run
	var gear: Dictionary = r.get("pending_gear_drop", {})
	if gear.is_empty():
		return
	var tmpl = _item_db.get_template(gear.get("base_key", ""))
	if tmpl.is_empty():
		return
	var slot = str(tmpl.get("slot", ""))

	# Move old item to gear bag
	var old = _gs.equipment.get(slot, {})
	if not old.is_empty():
		_gs.gear_bag.append(old)
	_gs.equipment[slot] = gear
	_gs.dg_log("Equipped " + str(tmpl.get("name", "")) + "!", "loot")
	r["pending_gear_drop"] = {}
	_update_run_ui()
	if after_fn.is_valid():
		after_fn.call()
	else:
		_delayed_generate_room()


func _on_stash_gear(after_fn: Callable) -> void:
	var r = _gs.dg_run
	var gear: Dictionary = r.get("pending_gear_drop", {})
	if gear.is_empty():
		return
	_gs.gear_bag.append(gear)
	var tmpl = _item_db.get_template(gear.get("base_key", ""))
	_gs.dg_log("Stashed " + str(tmpl.get("name", "item")) + " in gear bag.", "loot")
	r["pending_gear_drop"] = {}
	_update_run_ui()
	if after_fn.is_valid():
		after_fn.call()
	else:
		_delayed_generate_room()


func _on_salvage_gear(after_fn: Callable) -> void:
	var r = _gs.dg_run
	var gear: Dictionary = r.get("pending_gear_drop", {})
	if gear.is_empty():
		return
	var dust_val = _item_db.get_salvage_value(gear)
	_gs.add_dust(dust_val)
	var tmpl = _item_db.get_template(gear.get("base_key", ""))
	_gs.dg_log("Salvaged " + str(tmpl.get("name", "item")) + " for " + str(dust_val) + " dust.", "loot")
	r["pending_gear_drop"] = {}
	_update_run_ui()
	if after_fn.is_valid():
		after_fn.call()
	else:
		_delayed_generate_room()


func _format_gear_stat(stat_key: String, val) -> String:
	if stat_key in _item_db.PCT_STATS:
		return str(roundi(float(val) * 100.0)) + "%"
	elif stat_key in _item_db.DECIMAL_STATS:
		return str(snapped(float(val), 0.01))
	else:
		var prefix := "+" if int(val) >= 0 else ""
		return prefix + str(roundi(float(val)))


func _play_gear_drop_effects(rarity: String) -> void:
	var sfx_mgr := get_node_or_null("/root/SfxManager")
	if sfx_mgr:
		match rarity:
			"common", "uncommon":
				sfx_mgr.play_sfx(_sfx_loot_common)
			"rare":
				sfx_mgr.play_sfx(_sfx_loot_rare)
			_:
				sfx_mgr.play_sfx(_sfx_loot_epic)

	# Screen flash per rarity — more flashes for better loot
	var flash_color: Color = RARITY_FLASH_COLORS.get(rarity, Color.TRANSPARENT)
	if flash_color.a > 0:
		_spawn_screen_flash(flash_color)
		if rarity in ["epic", "legendary", "mythic"]:
			get_tree().create_timer(0.15).timeout.connect(func(): _spawn_screen_flash(flash_color))
		if rarity in ["legendary", "mythic"]:
			get_tree().create_timer(0.30).timeout.connect(func(): _spawn_screen_flash(flash_color))

	# Sparkle particles — count scales with rarity
	var sparkle_count: int = 0
	var sparkle_color: Color = Color.WHITE
	match rarity:
		"uncommon":
			sparkle_count = 4
			sparkle_color = ThemeManager.RARITY_COLORS["uncommon"].lightened(0.3)
		"rare":
			sparkle_count = 7
			sparkle_color = ThemeManager.RARITY_COLORS["rare"].lightened(0.3)
		"epic":
			sparkle_count = 10
			sparkle_color = ThemeManager.RARITY_COLORS["epic"].lightened(0.3)
		"legendary":
			sparkle_count = 14
			sparkle_color = ThemeManager.COLOR_GOLD_BRIGHT
		"mythic":
			sparkle_count = 18
			sparkle_color = Color(1.0, 0.4, 0.4)
	if sparkle_count > 0:
		_spawn_loot_sparkles(sparkle_count, sparkle_color)

	# Sprite pulse animation for rare+
	if rarity in ["rare", "epic", "legendary", "mythic"]:
		_pulse_room_sprite()


func _spawn_loot_sparkles(count: int, color: Color) -> void:
	# Wait one frame so room_sprite has its layout position
	await get_tree().process_frame
	var center := room_sprite.global_position + room_sprite.size * 0.5
	for i in count:
		var delay := randf() * 0.6
		get_tree().create_timer(delay).timeout.connect(func():
			var sparkle := ColorRect.new()
			var sz := randf_range(1.5, 3.5)
			sparkle.size = Vector2(sz, sz)
			sparkle.color = color.lightened(randf_range(0.1, 0.4))
			sparkle.position = center + Vector2(randf_range(-28, 28), randf_range(-20, 20))
			sparkle.mouse_filter = Control.MOUSE_FILTER_IGNORE
			add_child(sparkle)
			var tw := create_tween()
			tw.tween_property(sparkle, "position:y", sparkle.position.y - randf_range(15, 40), randf_range(0.7, 1.3))
			tw.parallel().tween_property(sparkle, "modulate:a", 0.0, randf_range(0.8, 1.4))
			tw.tween_callback(sparkle.queue_free)
		)


func _pulse_room_sprite() -> void:
	var tw := create_tween()
	tw.tween_property(room_sprite, "modulate", Color(2.5, 2.5, 2.5), 0.12)
	tw.tween_property(room_sprite, "modulate", room_sprite.modulate, 0.25)


func _spawn_screen_flash(color: Color) -> void:
	var flash := ColorRect.new()
	flash.color = color
	flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(flash)
	var tw := create_tween()
	tw.tween_property(flash, "color:a", 0.0, 0.2)
	tw.tween_callback(flash.queue_free)


# ==================== COMBAT VICTORY (called from battle.gd) ====================

func _handle_post_battle() -> void:
	var r = _gs.dg_run
	if r.is_empty():
		return

	var state_val = str(r.get("state", ""))
	if state_val == "dead":
		_show_death()
		return
	if state_val == "combat_won":
		_handle_combat_victory()
		return
	# If state is exploring and we have an active run, just generate next room
	if state_val == "exploring":
		_generate_room()


func _handle_combat_victory() -> void:
	var r = _gs.dg_run
	var room_num = int(r.get("room", 0))
	var floor_num = int(r.get("floor", 1))
	var is_boss = room_num == 3

	# Rotating room-clear SFX
	var sfx_mgr := get_node_or_null("/root/SfxManager")
	if sfx_mgr and not _room_clear_pool.is_empty():
		var is_final_boss := floor_num >= 8 and room_num == 3
		if is_final_boss:
			# Special boss fanfare — louder victory-3
			sfx_mgr.play_sfx(_room_clear_pool[2], 2.0)
		else:
			sfx_mgr.play_sfx(_room_clear_pool[_room_clear_idx])
			_room_clear_idx = (_room_clear_idx + 1) % _room_clear_pool.size()

	# Dio boss kill comment (non-final bosses only)
	if is_boss and not (floor_num >= 8 and room_num == 3):
		get_tree().create_timer(0.5).timeout.connect(func():
			DioPopup.spawn(self, "boss_kill")
		)

	# Gold reward
	var gold_scale = 1.0 + float(_gs.dungeon_clears) * 0.1
	var gold_reward = roundi((5.0 + randf() * 10.0) * float(floor_num) * gold_scale)
	if is_boss:
		gold_reward = roundi(float(gold_reward) * 1.5)
	r["gold"] = int(r.get("gold", 0)) + gold_reward
	r["total_kills"] = int(r.get("total_kills", 0)) + 1

	var monster_name = str(r.get("last_combat_stats", {}).get("monster_name", "Monster"))
	_mark_room_cleared_with_name(monster_name)
	_gs.dg_log(monster_name + " defeated! +" + str(gold_reward) + " gold.", "loot")

	# Follower drop chance
	var follower_chance = 0.25 if is_boss else 0.08
	var dropped_follower: Dictionary = {}
	if randf() < follower_chance:
		dropped_follower = _roll_cage_follower(floor_num)

	# Gear drop: boss = guaranteed, regular = 15%
	var gear_drop: Dictionary = {}
	if is_boss:
		gear_drop = _item_db.roll_gear_drop(floor_num, _gs.dungeon_clears)
	elif randf() < 0.15:
		gear_drop = _item_db.roll_gear_drop(floor_num, _gs.dungeon_clears)

	r["state"] = "exploring"

	# Build victory intermission
	var stats: Dictionary = r.get("last_combat_stats", {})
	var hp = int(r.get("hp", 0))
	var max_hp = int(r.get("max_hp", 1))
	var hp_pct = roundi(float(hp) / float(max_hp) * 100.0)

	var title = "BOSS DEFEATED!" if is_boss else "VICTORY!"
	var title_color = ThemeManager.COLOR_GOLD_BRIGHT if is_boss else ThemeManager.COLOR_HP_GREEN

	var body = monster_name + " slain!" + (" (BOSS)" if is_boss else "")
	body += "\nDealt: " + str(int(stats.get("dmg_dealt", 0)))
	body += "  Taken: " + str(int(stats.get("dmg_taken", 0)))
	body += "  +" + str(gold_reward) + "g"
	body += "\nHP: " + str(hp) + "/" + str(max_hp) + " (" + str(hp_pct) + "%)"

	# Chain drops: gear first, then follower, then check victory/continue
	var after_all = func():
		if floor_num >= 8 and room_num == 3:
			_show_victory()
		else:
			_generate_room()

	var after_gear: Callable = after_all
	if not dropped_follower.is_empty():
		var f_ref = dropped_follower
		var final_after = after_all
		after_gear = func():
			_show_follower_capture(f_ref, final_after)

	if not gear_drop.is_empty():
		var g_ref = gear_drop
		var next_after = after_gear
		var show_gear_fn = func():
			_show_gear_drop(g_ref, next_after)

		body += "\nSomething shiny drops..."

		_show_intermission(title, title_color, body, "See your loot", show_gear_fn)
	elif not dropped_follower.is_empty():
		var f_ref2 = dropped_follower
		var final2 = after_all
		var show_follower_fn = func():
			_show_follower_capture(f_ref2, final2)

		body += "\nA creature stirs..."

		_show_intermission(title, title_color, body, "See what you found", show_follower_fn)
	else:
		if floor_num >= 8 and room_num == 3:
			_show_intermission("FINAL BOSS SLAIN!", ThemeManager.COLOR_GOLD_BRIGHT, body, "Claim Victory", func(): _show_victory())
		else:
			_show_intermission(title, title_color, body, "Continue", func(): _generate_room())

	_update_progress()
	_update_run_ui()


# ==================== INTERMISSION SCREEN ====================

func _show_intermission(title: String, title_color: Color, body: String, next_label: String, next_fn: Callable) -> void:
	_clear_room_actions()

	# Smooth fade-in
	room_content.modulate.a = 0.0
	var fade_tw := create_tween()
	fade_tw.tween_property(room_content, "modulate:a", 1.0, 0.35)

	room_sprite.visible = false
	room_icon.visible = false
	room_title.text = title
	room_title.add_theme_color_override("font_color", title_color)
	room_title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])

	room_desc.clear()
	room_desc.append_text("[font_size=8]" + body + "[/font_size]")

	_add_room_button(next_label, next_fn)

	_update_progress()
	_update_run_ui()


# ==================== VICTORY / DEFEAT ====================

func _show_victory() -> void:
	var r = _gs.dg_run
	_gs.dungeon_clears += 1
	_gs.dg_log("Dungeon cleared! (Clear #" + str(_gs.dungeon_clears) + ")", "loot")

	# Keep all followers
	var run_followers: Array = r.get("followers", [])
	for f in run_followers:
		if not f.get("_brought", false):
			_gs.followers.append(f)

	# Victory gear drop
	var bonus_gear = _item_db.roll_gear_drop(int(r.get("floor", 1)) + 2, _gs.dungeon_clears)
	if not bonus_gear.is_empty():
		_gs.gear_bag.append(bonus_gear)

	# Bonus follower
	var bonus_follower = _roll_cage_follower(int(r.get("floor", 1)) + 2)
	if not bonus_follower.is_empty():
		_gs.followers.append(bonus_follower)

	_clear_room_actions()
	_set_room_sprite(ROOM_SPRITE_PATHS["victory"], ThemeManager.COLOR_GOLD_BRIGHT)
	room_title.text = "DUNGEON CONQUERED!"
	room_title.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	room_title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])

	var next_diff = _gs.dungeon_clears * 15

	room_desc.clear()
	room_desc.append_text("[font_size=8]")
	room_desc.append_text("Clear [b]#" + str(_gs.dungeon_clears) + "[/b] complete!\n\n")
	room_desc.append_text("Rooms: " + str(_room_history_size()) + "\n")
	room_desc.append_text("Kills: " + str(int(r.get("total_kills", 0))) + "\n")
	room_desc.append_text("[color=#ffcc44]Gold: " + str(int(r.get("gold", 0))) + "[/color]\n")
	room_desc.append_text("All [b]" + str(run_followers.size()) + "[/b] followers kept!\n")
	if not bonus_gear.is_empty():
		var tmpl = _item_db.get_template(bonus_gear.get("base_key", ""))
		if not tmpl.is_empty():
			var col = _item_db.get_rarity_color(tmpl.get("rarity", "common"))
			room_desc.append_text("Victory Reward: [color=" + col + "]" + str(tmpl.get("name", "")) + " (" + str(tmpl.get("rarity", "")) + ")[/color]\n")
	room_desc.append_text("\n[color=#cc6666]Next descent: +" + str(next_diff) + "% difficulty[/color]")
	room_desc.append_text("[/font_size]")

	_add_room_button("Return Victorious", _end_dungeon_run)
	_update_run_ui()

	# Dio victory celebration
	get_tree().create_timer(1.0).timeout.connect(func():
		DioPopup.spawn(self, "victory")
	)


func _show_death() -> void:
	var r = _gs.dg_run

	# Keep half of captured followers
	var run_followers: Array = r.get("followers", [])
	var captured: Array = []
	for f in run_followers:
		if not f.get("_brought", false):
			captured.append(f)
	var keep_count = ceili(float(captured.size()) / 2.0)
	for i in keep_count:
		_gs.followers.append(captured[i])

	_clear_room_actions()
	_set_room_sprite(ROOM_SPRITE_PATHS["death"], ThemeManager.COLOR_HP_RED)
	room_title.text = "DEFEATED"
	room_title.add_theme_color_override("font_color", ThemeManager.COLOR_HP_RED)
	room_title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])

	room_desc.clear()
	room_desc.append_text("[font_size=8]")
	room_desc.append_text("Fell on [b]Floor " + str(int(r.get("floor", 1))) + ", Room " + str(int(r.get("room", 0))) + "[/b]\n\n")
	room_desc.append_text("Rooms: " + str(_room_history_size()) + "\n")
	room_desc.append_text("Kills: " + str(int(r.get("total_kills", 0))) + "\n")
	room_desc.append_text("[color=#ffcc44]Gold: " + str(int(r.get("gold", 0))) + "[/color]\n")
	room_desc.append_text("Dmg Dealt: " + str(int(r.get("total_dmg_dealt", 0))) + "\n")
	room_desc.append_text("Dmg Taken: " + str(int(r.get("total_dmg_taken", 0))) + "\n\n")
	room_desc.append_text("Followers kept: [b]" + str(keep_count) + "/" + str(run_followers.size()) + "[/b]")
	room_desc.append_text("[/font_size]")

	_add_room_button("Return", _end_dungeon_run)
	_update_run_ui()

	# Dio death commentary
	get_tree().create_timer(0.8).timeout.connect(func():
		DioPopup.spawn(self, "death")
	)


func _end_dungeon_run() -> void:
	_gs.reset_dungeon_run()
	_selected_companion_idx = -1
	_show_pick_screen()


# ==================== POTION / ABANDON ====================

func _on_use_potion() -> void:
	var r = _gs.dg_run
	if r.is_empty() or int(r.get("potions", 0)) <= 0:
		return
	r["potions"] = int(r.get("potions", 0)) - 1
	var heal = roundi(float(int(r.get("max_hp", 1))) * 0.35)
	r["hp"] = mini(int(r.get("max_hp", 1)), int(r.get("hp", 0)) + heal)
	_gs.dg_log("Used potion! Healed " + str(heal) + " HP.", "good")
	_update_run_ui()


func _on_abandon() -> void:
	var r = _gs.dg_run
	if r.is_empty():
		return
	# Keep captured followers
	var run_followers: Array = r.get("followers", [])
	for f in run_followers:
		if not f.get("_brought", false):
			_gs.followers.append(f)
	_end_dungeon_run()


# ==================== RUN ITEMS ====================

func _roll_run_item() -> Dictionary:
	var run_items: Array[Dictionary] = [
		{"name": "Whetstone", "desc": "+25 DMG", "key": "bonus_dmg", "value": 25},
		{"name": "Armor Shard", "desc": "+15 DEF", "key": "bonus_def", "value": 15},
		{"name": "Swift Elixir", "desc": "+0.15 AtkSpd", "key": "base_as", "value": 0.15},
		{"name": "Health Potion", "desc": "+1 Potion", "key": "potion", "value": 1},
		{"name": "Life Crystal", "desc": "+400 Max HP", "key": "hp_bonus", "value": 400},
		{"name": "Crit Stone", "desc": "+8% Crit Chance", "key": "crit", "value": 0.08},
		{"name": "Mana Gem", "desc": "+15 Mana", "key": "mana", "value": 15},
	]
	return run_items[randi() % run_items.size()]


func _apply_run_item(item: Dictionary) -> void:
	var r = _gs.dg_run
	var key = str(item.get("key", ""))
	var val = item.get("value", 0)
	match key:
		"bonus_dmg":
			r["bonus_dmg"] = int(r.get("bonus_dmg", 0)) + int(val)
		"bonus_def":
			r["bonus_def"] = int(r.get("bonus_def", 0)) + int(val)
		"base_as":
			r["base_as"] = float(r.get("base_as", 0.0)) + float(val)
		"potion":
			r["potions"] = mini(int(r.get("max_potions", 3)), int(r.get("potions", 0)) + 1)
		"hp_bonus":
			r["max_hp"] = int(r.get("max_hp", 0)) + int(val)
			r["hp"] = int(r.get("hp", 0)) + int(val)
			r["bonus_hp"] = int(r.get("bonus_hp", 0)) + int(val)
		"crit":
			r["crit"] = float(r.get("crit", 0.0)) + float(val)
		"mana":
			r["max_mana"] = int(r.get("max_mana", 0)) + int(val)
			r["mana"] = int(r.get("mana", 0)) + int(val)


# ==================== LEFT PANEL — EQUIPMENT & GEAR BAG ====================

func _refresh_left_panel() -> void:
	for child in left_vbox.get_children():
		child.queue_free()

	var pf: Font = null
	var tm_node := get_node_or_null("/root/ThemeManager")
	if tm_node:
		pf = tm_node.pixel_font

	# Header
	var header := Label.new()
	header.text = "EQUIPMENT"
	header.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	header.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	if pf:
		header.add_theme_font_override("font", pf)
	left_vbox.add_child(header)

	var slot_abbrev: Dictionary = {"weapon": "WPN", "helmet": "HLM", "chest": "CHT", "boots": "BTS", "accessory": "ACC"}
	var slots: Array[String] = ["weapon", "helmet", "chest", "boots", "accessory"]
	for slot in slots:
		var item: Dictionary = _gs.equipment.get(slot, {})
		var lbl := Label.new()
		lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		if pf:
			lbl.add_theme_font_override("font", pf)
		lbl.clip_text = true
		if item.is_empty():
			lbl.text = slot_abbrev.get(slot, slot) + ": (empty)"
			lbl.add_theme_color_override("font_color", Color(0.4, 0.4, 0.4))
		else:
			var tmpl = _item_db.get_template(item.get("base_key", ""))
			var rarity = tmpl.get("rarity", "common")
			var col_str = _item_db.get_rarity_color(rarity)
			lbl.text = slot_abbrev.get(slot, slot) + ": " + str(tmpl.get("name", "?"))
			lbl.add_theme_color_override("font_color", Color.from_string(col_str, Color.GRAY))
			# Stat summary below
			var desc_txt = str(item.get("desc", ""))
			if desc_txt != "":
				var stat_lbl := Label.new()
				stat_lbl.text = "  " + desc_txt
				stat_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
				stat_lbl.add_theme_color_override("font_color", Color(0.5, 0.5, 0.5))
				stat_lbl.clip_text = true
				if pf:
					stat_lbl.add_theme_font_override("font", pf)
				left_vbox.add_child(lbl)
				left_vbox.add_child(stat_lbl)
				continue
		left_vbox.add_child(lbl)

	# Gear bag
	var bag_header := Label.new()
	bag_header.text = "BAG (" + str(_gs.gear_bag.size()) + ")"
	bag_header.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	bag_header.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	if pf:
		bag_header.add_theme_font_override("font", pf)
	left_vbox.add_child(bag_header)

	if _gs.gear_bag.is_empty():
		var empty_lbl := Label.new()
		empty_lbl.text = "(empty)"
		empty_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		empty_lbl.add_theme_color_override("font_color", Color(0.4, 0.4, 0.4))
		if pf:
			empty_lbl.add_theme_font_override("font", pf)
		left_vbox.add_child(empty_lbl)
	else:
		for i in _gs.gear_bag.size():
			var bag_item: Dictionary = _gs.gear_bag[i]
			var tmpl = _item_db.get_template(bag_item.get("base_key", ""))
			var rarity = tmpl.get("rarity", "common")
			var col_str: String = _item_db.get_rarity_color(rarity)

			# Item name
			var name_lbl := Label.new()
			name_lbl.text = str(tmpl.get("name", "?")) + " (" + str(tmpl.get("slot", "?"))[0].to_upper() + ")"
			name_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
			name_lbl.add_theme_color_override("font_color", Color.from_string(col_str, Color.GRAY))
			name_lbl.clip_text = true
			if pf:
				name_lbl.add_theme_font_override("font", pf)
			left_vbox.add_child(name_lbl)

			# Equip / Salvage buttons
			var row := HBoxContainer.new()
			row.add_theme_constant_override("separation", 2)
			left_vbox.add_child(row)

			var equip_btn := Button.new()
			equip_btn.text = "Equip"
			equip_btn.custom_minimum_size = Vector2(40, 14)
			if pf:
				equip_btn.add_theme_font_override("font", pf)
			equip_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
			equip_btn.pressed.connect(_on_equip_from_bag.bind(i))
			row.add_child(equip_btn)

			var dust_val = _item_db.get_salvage_value(bag_item)
			if dust_val > 0:
				var salv_btn := Button.new()
				salv_btn.text = "Salv(" + str(dust_val) + ")"
				salv_btn.custom_minimum_size = Vector2(50, 14)
				if pf:
					salv_btn.add_theme_font_override("font", pf)
				salv_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
				salv_btn.pressed.connect(_on_salvage_from_bag.bind(i))
				row.add_child(salv_btn)


func _on_equip_from_bag(bag_idx: int) -> void:
	if bag_idx < 0 or bag_idx >= _gs.gear_bag.size():
		return
	var gear: Dictionary = _gs.gear_bag[bag_idx]
	var tmpl = _item_db.get_template(gear.get("base_key", ""))
	if tmpl.is_empty():
		return
	var slot = str(tmpl.get("slot", ""))
	var old = _gs.equipment.get(slot, {})
	_gs.equipment[slot] = gear
	_gs.gear_bag.remove_at(bag_idx)
	if not old.is_empty():
		_gs.gear_bag.append(old)
	_gs.dg_log("Equipped " + str(tmpl.get("name", "")) + "!", "loot")
	_update_run_ui()


func _on_salvage_from_bag(bag_idx: int) -> void:
	if bag_idx < 0 or bag_idx >= _gs.gear_bag.size():
		return
	var gear: Dictionary = _gs.gear_bag[bag_idx]
	var dust_val = _item_db.get_salvage_value(gear)
	var tmpl = _item_db.get_template(gear.get("base_key", ""))
	_gs.add_dust(dust_val)
	_gs.gear_bag.remove_at(bag_idx)
	_gs.dg_log("Salvaged " + str(tmpl.get("name", "item")) + " for " + str(dust_val) + " dust.", "loot")
	_update_run_ui()


# ==================== RIGHT PANEL — COMPANIONS ====================

func _refresh_right_panel() -> void:
	for child in right_vbox.get_children():
		child.queue_free()

	var pf: Font = null
	var tm_node := get_node_or_null("/root/ThemeManager")
	if tm_node:
		pf = tm_node.pixel_font

	var r = _gs.dg_run
	if r.is_empty():
		return

	# Header
	var header := Label.new()
	header.text = "COMPANIONS"
	header.add_theme_color_override("font_color", Color(0.6, 0.4, 0.8))
	header.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	if pf:
		header.add_theme_font_override("font", pf)
	right_vbox.add_child(header)

	var deployed: Dictionary = r.get("deployed_follower", {})
	var run_followers: Array = r.get("followers", [])

	if run_followers.is_empty():
		var empty_lbl := Label.new()
		empty_lbl.text = "(none)"
		empty_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		empty_lbl.add_theme_color_override("font_color", Color(0.4, 0.4, 0.4))
		if pf:
			empty_lbl.add_theme_font_override("font", pf)
		right_vbox.add_child(empty_lbl)
		return

	# Show each follower
	for i in run_followers.size():
		var f = run_followers[i]
		var f_name = str(f.get("template_name", f.get("name", "???")))
		var f_tmpl = _fdb.get_template(f_name)
		var f_rarity = f.get("rarity", f_tmpl.get("rarity", "common"))
		var f_col = _fdb.get_rarity_color(f_rarity)
		var is_deployed = (not deployed.is_empty() and f_name == str(deployed.get("template_name", deployed.get("name", ""))))

		# Name label with rarity color
		var name_lbl := Label.new()
		if is_deployed:
			name_lbl.text = f_name + " [D]"
		else:
			name_lbl.text = f_name
		name_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		name_lbl.add_theme_color_override("font_color", Color.from_string(f_col, Color.GRAY))
		name_lbl.clip_text = true
		if pf:
			name_lbl.add_theme_font_override("font", pf)
		right_vbox.add_child(name_lbl)

		# Buff/stats
		var buff_desc = f_tmpl.get("buff_desc", "")
		if buff_desc != "":
			var buff_lbl := Label.new()
			buff_lbl.text = "  " + buff_desc
			buff_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
			buff_lbl.add_theme_color_override("font_color", Color(0.5, 0.5, 0.5))
			buff_lbl.clip_text = true
			if pf:
				buff_lbl.add_theme_font_override("font", pf)
			right_vbox.add_child(buff_lbl)

		# Deploy button (if not already deployed)
		if not is_deployed:
			var btn := Button.new()
			btn.text = "Deploy"
			btn.custom_minimum_size = Vector2(50, 14)
			if pf:
				btn.add_theme_font_override("font", pf)
			btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
			btn.pressed.connect(_on_deploy_follower.bind(i))
			right_vbox.add_child(btn)


func _on_deploy_follower(idx: int) -> void:
	var r = _gs.dg_run
	var run_followers: Array = r.get("followers", [])
	if idx < 0 or idx >= run_followers.size():
		return
	var f = run_followers[idx]
	r["deployed_follower"] = f
	var f_name = str(f.get("template_name", f.get("name", "Companion")))
	_gs.dg_log("Deployed " + f_name + " as combat companion!", "good")

	var buff_desc = _gs.apply_follower_buff_to_run(f)
	if buff_desc != "":
		_gs.dg_log("Buff: " + buff_desc, "good")

	_update_run_ui()


# ==================== HELPERS ====================

func _mark_room_cleared() -> void:
	var r = _gs.dg_run
	var history: Array = r.get("room_history", [])
	if not history.is_empty():
		history[history.size() - 1]["cleared"] = true


func _mark_room_cleared_with_name(room_name: String) -> void:
	var r = _gs.dg_run
	var history: Array = r.get("room_history", [])
	if not history.is_empty():
		history[history.size() - 1]["cleared"] = true
		history[history.size() - 1]["name"] = room_name


func _room_history_size() -> int:
	var r = _gs.dg_run
	return int(r.get("room_history", []).size())


func _delayed_generate_room() -> void:
	await get_tree().create_timer(0.6).timeout
	_generate_room()
