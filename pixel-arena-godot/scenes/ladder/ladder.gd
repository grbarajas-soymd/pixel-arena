extends Control
## Ladder gauntlet — port of src/modes/ladder.js
## Flow: Picker -> Follower Pick -> Battle -> Intermission -> repeat or defeat

@onready var wins_label: Label = %WinsLabel
@onready var fight_btn: Button = %FightBtn
@onready var back_btn: Button = %BackBtn
@onready var opponent_preview: PanelContainer = %OpponentPreview
@onready var content_vbox: VBoxContainer = %ContentVBox

var _gs: Node
var _hero_factory: HeroFactory

# Data
var _classes: Dictionary = {}
var _items: Dictionary = {}
var _skills_data: Array = []
var _ults_data: Array = []
var _followers_data: Array = []

# Current UI state: "picker", "follower_pick", "intermission"
var _screen: String = "picker"

# Companion selection for current fight (single follower, no wager)
var _companion_index: int = -1

# Dynamic UI nodes for cleanup
var _dynamic_container: VBoxContainer = null

const HERO_SPRITE_PATH := "res://assets/sprites/generated/heroes/"

const TITLES: Array[String] = [
	" the Bold", " the Cruel", " the Swift", " the Wise",
	" the Fierce", " the Dark", " the Radiant", " the Cursed",
	"", "", ""
]


func _ready() -> void:
	_gs = get_node("/root/GameState")
	_hero_factory = HeroFactory.new()
	add_child(_hero_factory)

	# Connect button signals FIRST — before any setup that could fail
	fight_btn.pressed.connect(_on_fight_pressed)
	back_btn.pressed.connect(_on_back_pressed)
	fight_btn.disabled = false

	_load_data()
	_setup_background()
	ThemeManager.style_stone_button(fight_btn, ThemeManager.COLOR_GOLD_BRIGHT)
	ThemeManager.style_stone_button(back_btn)

	var sfx := get_node_or_null("/root/SfxManager")
	if sfx:
		sfx.play_context("menu")

	# Check if returning from battle
	var result: String = _gs._ladder_result
	if result != "" and not _gs.ladder_run.is_empty() and _gs.ladder_run.get("active", false):
		_gs._ladder_result = ""
		_handle_battle_result(result)
	elif not _gs.ladder_run.is_empty() and _gs.ladder_run.get("active", false):
		# Resuming an active run — show follower pick
		_show_follower_pick()
	else:
		_show_picker()


func _load_data() -> void:
	var f := FileAccess.open("res://data/classes.json", FileAccess.READ)
	if f:
		_classes = JSON.parse_string(f.get_as_text())
		f.close()
	var fi := FileAccess.open("res://data/items.json", FileAccess.READ)
	if fi:
		_items = JSON.parse_string(fi.get_as_text())
		fi.close()
	var sf := FileAccess.open("res://data/skills.json", FileAccess.READ)
	if sf:
		var sd = JSON.parse_string(sf.get_as_text())
		sf.close()
		if sd is Dictionary:
			_skills_data = sd.get("skills", [])
			_ults_data = sd.get("ultimates", [])
	var ff := FileAccess.open("res://data/followers.json", FileAccess.READ)
	if ff:
		var fd = JSON.parse_string(ff.get_as_text())
		ff.close()
		if fd is Dictionary:
			_followers_data = fd.get("templates", [])


func _setup_background() -> void:
	# Keep the existing Background ColorRect — just layer a texture on top of it
	var old_bg := $Background
	if old_bg:
		old_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	# Also ensure the Margin doesn't eat mouse events itself
	var margin := $Margin
	if margin:
		margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var tex = load("res://assets/tilesets/battle_backgrounds/graveyard.png")
	if tex:
		var bg := TextureRect.new()
		bg.texture = tex
		bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
		bg.modulate = Color(0.15, 0.15, 0.30, 1.0)
		# Insert between Background and Margin (index 1) — no node replacement needed
		add_child(bg)
		move_child(bg, 1)

	var title := $Margin/VBox/Header/Title
	if title:
		title.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
		title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])


# ============ SCREENS ============

func _clear_dynamic() -> void:
	if _dynamic_container and is_instance_valid(_dynamic_container):
		_dynamic_container.queue_free()
		_dynamic_container = null


func _show_picker() -> void:
	_screen = "picker"
	_clear_dynamic()
	var class_key: String = _gs.custom_char.get("class_key", "barbarian")
	var cc := ThemeManager.get_class_color(class_key)
	wins_label.text = "Best: " + str(_gs.ladder_best) + "W"
	wins_label.add_theme_color_override("font_color", cc)
	wins_label.visible = true
	opponent_preview.visible = false
	fight_btn.text = "Start Climb"
	fight_btn.custom_minimum_size = Vector2(160, 30)
	fight_btn.visible = true
	back_btn.text = "Back"
	back_btn.visible = true

	# Hero preview panel
	_dynamic_container = VBoxContainer.new()
	_dynamic_container.add_theme_constant_override("separation", 2)
	content_vbox.add_child(_dynamic_container)

	var hero_panel := PanelContainer.new()
	_dynamic_container.add_child(hero_panel)
	var hero_hbox := HBoxContainer.new()
	hero_hbox.add_theme_constant_override("separation", 8)
	hero_hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	hero_panel.add_child(hero_hbox)

	# Hero sprite
	_add_opponent_sprite(hero_hbox, class_key)

	# Hero info
	var info := VBoxContainer.new()
	info.add_theme_constant_override("separation", 1)
	hero_hbox.add_child(info)
	var hero_name: String = str(_gs.custom_char.get("name", "Hero"))
	_add_label(info, hero_name, 8, cc)
	var stats: Dictionary = _gs.get_total_stats()
	var hp := roundi(float(stats.get("hp", 0)))
	var dmg := roundi(float(stats.get("base_dmg", 0)))
	var as_val := snappedf(float(stats.get("base_as", 0)), 0.01)
	var def := roundi(float(stats.get("def", 0)))
	var eva_pct := roundi(float(stats.get("evasion", 0)) * 100.0)
	_add_label(info, str(hp) + " HP | " + str(dmg) + " DMG | " + str(as_val) + " AS", 8, ThemeManager.COLOR_TEXT_LIGHT)
	_add_label(info, str(def) + " DEF | " + str(eva_pct) + "% EVA", 8, ThemeManager.COLOR_TEXT_DIM)


func _show_follower_pick() -> void:
	_screen = "follower_pick"
	_clear_dynamic()
	# Auto-select companion: use active_follower from game state, or first available
	if _gs.followers.size() > 0:
		var active_f: int = int(_gs.active_follower) if _gs.active_follower >= 0 else 0
		_companion_index = clampi(active_f, 0, _gs.followers.size() - 1)
	else:
		_companion_index = -1

	var run: Dictionary = _gs.ladder_run
	var fight_num: int = int(run.get("wins", 0)) + 1
	var opp_idx: int = int(run.get("opponent_idx", 0))

	wins_label.text = "Wins: " + str(run.get("wins", 0))
	wins_label.add_theme_color_override("font_color", ThemeManager.COLOR_BORDER_GOLD)
	wins_label.visible = true
	fight_btn.text = "FIGHT!"
	fight_btn.custom_minimum_size = Vector2(160, 30)
	fight_btn.visible = true
	back_btn.text = "Forfeit"
	back_btn.visible = true

	# Show opponent preview
	_show_opponent_preview(opp_idx, fight_num)

	# Show follower assignment UI if player has followers
	if _gs.followers.size() > 0:
		_dynamic_container = VBoxContainer.new()
		_dynamic_container.add_theme_constant_override("separation", 3)
		content_vbox.add_child(_dynamic_container)
		_rebuild_follower_ui()


func _show_opponent_preview(opp_idx: int, fight_num: int) -> void:
	for child in opponent_preview.get_children():
		child.queue_free()
	opponent_preview.visible = true

	var hbox := HBoxContainer.new()
	hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	hbox.add_theme_constant_override("separation", 8)
	opponent_preview.add_child(hbox)

	var seq := CombatConstants.LADDER_SEQUENCE

	if opp_idx < seq.size():
		# Class opponent
		var class_key: String = seq[opp_idx]
		var cls: Dictionary = _classes.get(class_key, {})
		var s_hp := roundi(float(cls.get("hp", 4000)) * 0.7)
		var s_dmg := roundi(float(cls.get("base_dmg", 100)) * 0.7)
		var s_as := snappedf(float(cls.get("base_as", 0.8)) * 0.7, 0.01)
		var s_def := roundi(float(cls.get("def", 40)) * 0.7)

		# Sprite
		_add_opponent_sprite(hbox, class_key)

		# Info
		var info := VBoxContainer.new()
		info.add_theme_constant_override("separation", 1)
		hbox.add_child(info)
		_add_label(info, "OPPONENT #" + str(fight_num), 8, ThemeManager.COLOR_TEXT_LIGHT)
		_add_label(info, cls.get("name", class_key.capitalize()), 8, Color.from_string(str(cls.get("color", "#fff")), Color.WHITE))
		_add_label(info, str(s_hp) + " HP | " + str(s_dmg) + " DMG | " + str(s_as) + " AS | " + str(s_def) + " DEF", 8, ThemeManager.COLOR_TEXT_DIM)
	else:
		# Generated opponent — generate and cache
		var run: Dictionary = _gs.ladder_run
		if run.get("_previewed_next", {}).is_empty():
			run["_previewed_next"] = _generate_opponent(int(run.get("wins", 0)))
		var opp: Dictionary = run.get("_previewed_next", {})

		_add_opponent_sprite(hbox, str(opp.get("sprite", "barbarian")))

		var info := VBoxContainer.new()
		info.add_theme_constant_override("separation", 1)
		hbox.add_child(info)
		var cnum := opp_idx - seq.size() + 1
		_add_label(info, "CHALLENGER #" + str(cnum), 8, ThemeManager.COLOR_TEXT_LIGHT)
		_add_label(info, str(opp.get("name", "Unknown")), 8, ThemeManager.COLOR_BORDER_GOLD)
		var eva_pct := roundi(float(opp.get("evasion", 0)) * 100.0)
		_add_label(info, str(opp.get("hp", 0)) + " HP | " + str(opp.get("base_dmg", 0)) + " DMG | " + str(opp.get("base_as", 0)) + " AS | " + str(opp.get("def", 0)) + " DEF | " + str(eva_pct) + "% EVA", 8, ThemeManager.COLOR_TEXT_DIM)


func _add_opponent_sprite(parent: Node, class_key: String) -> void:
	var safe_key := class_key if not class_key.is_empty() else "barbarian"
	var tex = load(HERO_SPRITE_PATH + safe_key + "_base.png")
	if tex:
		var border := PanelContainer.new()
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(0.1, 0.1, 0.15)
		sb.border_color = ThemeManager.get_class_color(safe_key)
		sb.set_border_width_all(2)
		sb.set_corner_radius_all(3)
		sb.set_content_margin_all(3)
		border.add_theme_stylebox_override("panel", sb)
		var tex_rect := TextureRect.new()
		tex_rect.texture = tex
		tex_rect.expand_mode = TextureRect.EXPAND_FIT_HEIGHT_PROPORTIONAL
		tex_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tex_rect.custom_minimum_size = Vector2(80, 80)
		tex_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		border.add_child(tex_rect)
		parent.add_child(border)


func _add_label(parent: Node, text: String, font_size: int, color: Color) -> void:
	var lbl := Label.new()
	lbl.text = text
	lbl.add_theme_font_size_override("font_size", maxi(font_size, ThemeManager.FONT_SIZES["small"]))
	lbl.add_theme_color_override("font_color", color)
	parent.add_child(lbl)


# ============ FOLLOWER ASSIGNMENT UI ============

func _rebuild_follower_ui() -> void:
	if not _dynamic_container or not is_instance_valid(_dynamic_container):
		return
	for child in _dynamic_container.get_children():
		child.queue_free()

	# Companion section — single follower that buffs + fights alongside
	var comp_panel := PanelContainer.new()
	_dynamic_container.add_child(comp_panel)
	var comp_vbox := VBoxContainer.new()
	comp_vbox.add_theme_constant_override("separation", 2)
	comp_panel.add_child(comp_vbox)

	var comp_label := Label.new()
	comp_label.text = "COMPANION (optional — buffs your hero, fights alongside)"
	comp_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	comp_label.add_theme_color_override("font_color", ThemeManager.COLOR_ACCENT_TEAL)
	comp_vbox.add_child(comp_label)

	var comp_flow := HBoxContainer.new()
	comp_flow.add_theme_constant_override("separation", 3)
	comp_vbox.add_child(comp_flow)

	for i in range(_gs.followers.size()):
		var f: Dictionary = _gs.followers[i]
		var rarity_str: String = str(f.get("rarity", "common"))
		var is_selected: bool = (i == _companion_index)
		var accent: Color
		if is_selected:
			accent = ThemeManager.COLOR_SUCCESS_GREEN
		else:
			var rc: String = ThemeManager.RARITY_HEX.get(rarity_str, "#8a8a7a")
			accent = Color.from_string(rc, Color.GRAY)

		# Card container with rarity-colored border
		var card := PanelContainer.new()
		var card_sb := StyleBoxFlat.new()
		card_sb.bg_color = Color(0.12, 0.10, 0.16)
		card_sb.border_color = accent
		card_sb.set_border_width_all(1)
		card_sb.set_corner_radius_all(2)
		card_sb.set_content_margin_all(3)
		card.add_theme_stylebox_override("panel", card_sb)
		card.custom_minimum_size = Vector2(160, 36)

		var card_hbox := HBoxContainer.new()
		card_hbox.add_theme_constant_override("separation", 4)
		card.add_child(card_hbox)

		# Follower mini-icon (24x24)
		var fname: String = str(f.get("name", "")).to_snake_case()
		var fpath := "res://assets/sprites/generated/followers/" + fname + ".png"
		if ResourceLoader.exists(fpath):
			var ftex = load(fpath)
			if ftex:
				var ficon := TextureRect.new()
				ficon.texture = ftex
				ficon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
				ficon.expand_mode = TextureRect.EXPAND_FIT_HEIGHT_PROPORTIONAL
				ficon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
				ficon.custom_minimum_size = Vector2(24, 24)
				card_hbox.add_child(ficon)

		# Name + buff info
		var info_vbox := VBoxContainer.new()
		info_vbox.add_theme_constant_override("separation", 0)
		card_hbox.add_child(info_vbox)

		var name_lbl := Label.new()
		name_lbl.text = str(f.get("name", "?"))
		name_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		name_lbl.add_theme_color_override("font_color", accent)
		name_lbl.clip_text = true
		info_vbox.add_child(name_lbl)

		var buff_text: String = ""
		var buff: Dictionary = f.get("buff", {})
		if buff.has("hp"):
			buff_text += "+" + str(int(buff["hp"])) + "HP"
		if buff.has("base_dmg"):
			if buff_text != "":
				buff_text += " "
			buff_text += "+" + str(int(buff["base_dmg"])) + "DMG"
		if buff_text != "":
			var buff_lbl := Label.new()
			buff_lbl.text = buff_text
			buff_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
			buff_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
			info_vbox.add_child(buff_lbl)

		# Click handler via invisible button overlay
		var click_btn := Button.new()
		click_btn.flat = true
		click_btn.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		click_btn.mouse_filter = Control.MOUSE_FILTER_STOP
		click_btn.pressed.connect(_toggle_companion.bind(i))
		card.add_child(click_btn)

		comp_flow.add_child(card)


func _toggle_companion(idx: int) -> void:
	if _companion_index == idx:
		_companion_index = -1
	else:
		_companion_index = idx
	_rebuild_follower_ui()


# ============ OPPONENT GENERATION ============

func _generate_opponent(wins: int) -> Dictionary:
	var tier := clampi(wins - 3, 0, 25)
	var base_hp := 3200.0 + float(tier) * 140.0
	var base_dmg := 80.0 + float(tier) * 6.0
	var base_as := 0.7 + minf(float(tier) * 0.025, 0.5)
	var base_def := 20.0 + float(tier) * 2.0
	var base_eva := minf(0.01 * float(tier), 0.15)
	var base_spd := 90.0 + float(tier) * 2.0

	# Random equipment — 50% stat contribution
	var slots := ["weapon", "helmet", "chest", "boots", "accessory"]
	var equip: Dictionary = {}
	for slot in slots:
		var pool: Array[String] = []
		for key in _items:
			if key.begins_with("_"):
				continue
			var item: Dictionary = _items[key]
			if item.get("slot", "") == slot:
				pool.append(key)
		if pool.size() > 0:
			equip[slot] = pool[randi() % pool.size()]

	for sk in equip:
		var item: Dictionary = _items.get(equip[sk], {})
		if item.is_empty():
			continue
		var stats: Dictionary = item.get("stats", {})
		for k in stats:
			var v: float = float(stats[k]) * 0.5
			match k:
				"hp": base_hp += v
				"base_dmg": base_dmg += v
				"base_as": base_as += v
				"def": base_def += v
				"evasion": base_eva = minf(0.8, base_eva + v)
				"move_speed": base_spd += v

	# Random skills
	var sk1: int = randi() % maxi(1, _skills_data.size())
	var sk2: int = randi() % maxi(1, _skills_data.size())
	while sk2 == sk1 and _skills_data.size() > 1:
		sk2 = randi() % _skills_data.size()
	var ult_idx: int = randi() % maxi(1, _ults_data.size())

	# Random sprite
	var sprite_keys: Array[String] = ["wizard", "ranger", "assassin", "barbarian"]
	var sprite: String = sprite_keys[randi() % sprite_keys.size()]

	# Random name
	var names := CombatConstants.LADDER_NAMES
	var opp_name: String = names[randi() % names.size()]
	opp_name += TITLES[randi() % TITLES.size()]

	var range_type: String = "ranged"
	if sprite == "assassin" or sprite == "barbarian":
		range_type = "melee"

	return {
		"name": opp_name,
		"sprite": sprite,
		"hp": roundi(base_hp),
		"base_dmg": roundi(base_dmg),
		"base_as": snappedf(base_as, 0.01),
		"def": roundi(base_def),
		"evasion": snappedf(base_eva, 0.01),
		"move_speed": roundi(base_spd),
		"skills": [sk1, sk2],
		"ultimate": ult_idx,
		"equip": equip,
		"range_type": range_type,
		"is_generated": true,
	}


# ============ FOLLOWER ROLLING ============

func _roll_follower(floor_level: int) -> Dictionary:
	var rarity := _pick_rarity(floor_level)
	var pool: Array = []
	for t in _followers_data:
		if t.get("rarity", "") == rarity:
			pool.append(t)
	if pool.is_empty():
		for t in _followers_data:
			if t.get("rarity", "") == "common":
				pool.append(t)
	var tmpl: Dictionary = pool[randi() % pool.size()]
	return _follower_from_template(tmpl)


func _follower_from_template(tmpl: Dictionary) -> Dictionary:
	return {
		"id": str(Time.get_unix_time_from_system()) + "_" + str(randi()),
		"name": tmpl.get("name", ""),
		"template_name": tmpl.get("name", ""),
		"icon": tmpl.get("icon", ""),
		"rarity": tmpl.get("rarity", "common"),
		"buff": tmpl.get("buff", {}).duplicate(true),
		"buff_desc": tmpl.get("buff_desc", ""),
		"combat_hp": int(tmpl.get("combat_hp", 400)),
		"combat_dmg": int(tmpl.get("combat_dmg", 30)),
		"combat_as": float(tmpl.get("combat_as", 1.0)),
		"combat_def": int(tmpl.get("combat_def", 10)),
		"combat_range": int(tmpl.get("combat_range", 60)),
		"ability_name": tmpl.get("ability_name", ""),
		"ability_desc": tmpl.get("ability_desc", ""),
		"ability_bcd": int(tmpl.get("ability_bcd", 6000)),
		"has_on_death": tmpl.get("has_on_death", false),
		"wager_debuff": tmpl.get("wager_debuff", {}),
		"upgrades": 0,
	}


func _pick_rarity(floor_level: int) -> String:
	var weights: Array[float]
	if floor_level <= 2:
		weights = [70.0, 25.0, 5.0, 0.0, 0.0]
	elif floor_level <= 4:
		weights = [40.0, 35.0, 20.0, 5.0, 0.0]
	elif floor_level <= 6:
		weights = [20.0, 30.0, 30.0, 15.0, 5.0]
	else:
		weights = [10.0, 20.0, 30.0, 25.0, 15.0]
	var rarities: Array[String] = ["common", "uncommon", "rare", "epic", "legendary"]
	var total: float = 0.0
	for w in weights:
		total += w
	var r := randf() * total
	var acc: float = 0.0
	for i in range(weights.size()):
		acc += weights[i]
		if r <= acc:
			return rarities[i]
	return "common"


# ============ INPUT FALLBACK ============
# Direct input handler — bypasses GUI system in case something blocks button events
func _input(event: InputEvent) -> void:
	if not event is InputEventMouseButton:
		return
	if not event.pressed or event.button_index != MOUSE_BUTTON_LEFT:
		return
	if fight_btn.visible and fight_btn.get_global_rect().has_point(event.position):
		_on_fight_pressed()
		get_viewport().set_input_as_handled()
	elif back_btn.visible and back_btn.get_global_rect().has_point(event.position):
		_on_back_pressed()
		get_viewport().set_input_as_handled()


# ============ ACTIONS ============

func _on_fight_pressed() -> void:
	match _screen:
		"picker":
			_start_ladder()
		"follower_pick":
			_launch_fight()
		"intermission":
			_continue_ladder()


func _on_back_pressed() -> void:
	match _screen:
		"picker":
			TransitionManager.fade_to_scene("res://scenes/character_forge/character_forge.tscn")
		"follower_pick":
			_quit_ladder()
		"intermission":
			_quit_ladder()


func _start_ladder() -> void:
	_gs.ladder_run = {
		"wins": 0,
		"active": true,
		"opponent_idx": 0,
		"history": [],
		"_previewed_next": {},
		"current_opp_name": "",
		"current_opp_icon": "",
		"companion": -1,
		"last_player_hp": 0,
		"last_player_max_hp": 1,
		"last_opp_hp": 0,
	}
	_gs._ladder_mode = true
	_show_follower_pick()


func _launch_fight() -> void:
	var run: Dictionary = _gs.ladder_run
	if run.is_empty() or not run.get("active", false):
		return

	# Store companion selection
	run["companion"] = _companion_index

	var opp_idx: int = int(run.get("opponent_idx", 0))
	var seq := CombatConstants.LADDER_SEQUENCE

	# Build opponent config for battle.gd
	var opponent: Dictionary = {}
	if opp_idx < seq.size():
		# Class NPC
		var class_key: String = seq[opp_idx]
		opponent = {"class_key": class_key, "is_generated": false}
		var cls: Dictionary = _classes.get(class_key, {})
		run["current_opp_name"] = cls.get("name", class_key.capitalize())
		run["current_opp_icon"] = cls.get("icon", "?")
	else:
		# Generated opponent
		var opp_cfg: Dictionary = run.get("_previewed_next", {})
		if opp_cfg.is_empty():
			opp_cfg = _generate_opponent(int(run.get("wins", 0)))
		# Merge generated config as the opponent
		opponent = opp_cfg.duplicate(true)
		opponent["is_generated"] = true
		run["current_opp_name"] = opp_cfg.get("name", "Unknown")
		run["current_opp_icon"] = "?"
		run["_previewed_next"] = {}

	_gs._ladder_mode = true
	_gs._ladder_opponent = opponent
	_gs._ladder_result = ""

	TransitionManager.fade_to_scene("res://scenes/battle/battle.tscn")


func _handle_battle_result(result: String) -> void:
	var run: Dictionary = _gs.ladder_run
	var player_won: bool = result == "win"
	var opp_name: String = run.get("current_opp_name", "Opponent")
	var opp_icon: String = run.get("current_opp_icon", "?")

	# Record history
	var history: Array = run.get("history", [])
	history.append({
		"name": opp_name,
		"icon": opp_icon,
		"won": player_won,
		"player_hp_left": int(run.get("last_player_hp", 0)) if player_won else 0,
		"player_max_hp": int(run.get("last_player_max_hp", 1)),
		"opp_hp_left": 0 if player_won else int(run.get("last_opp_hp", 0)),
	})
	run["history"] = history

	# Reset companion (no loss on defeat — companion stays in roster)
	run["companion"] = -1

	var earned_follower: Dictionary = {}
	if player_won:
		run["wins"] = int(run.get("wins", 0)) + 1
		run["opponent_idx"] = int(run.get("opponent_idx", 0)) + 1
		_gs.ladder_wins = int(run.get("wins", 0))

		# Follower reward every 3 wins (rare+ rarity)
		if int(run.get("wins", 0)) % 3 == 0:
			var flr := mini(8, ceili(float(run.get("wins", 0)) / 2.0))
			earned_follower = _roll_follower(flr)
			var attempts := 0
			while (earned_follower.get("rarity", "") == "common" or earned_follower.get("rarity", "") == "uncommon") and attempts < 10:
				earned_follower = _roll_follower(flr)
				attempts += 1
			_gs.followers.append(earned_follower)
			SteamManager.check_follower(earned_follower, _gs.followers.size())
		SteamManager.check_ladder(_gs.ladder_wins, _gs.ladder_best)
	else:
		_gs.ladder_best = maxi(_gs.ladder_best, int(run.get("wins", 0)))
		SteamManager.check_ladder(_gs.ladder_wins, _gs.ladder_best)

	_gs._ladder_mode = false
	_show_intermission(player_won, earned_follower)


func _show_intermission(won: bool, earned_follower: Dictionary) -> void:
	_screen = "intermission"
	_clear_dynamic()
	opponent_preview.visible = false

	var run: Dictionary = _gs.ladder_run

	_dynamic_container = VBoxContainer.new()
	_dynamic_container.add_theme_constant_override("separation", 3)
	content_vbox.add_child(_dynamic_container)

	# Title
	if won:
		wins_label.text = "ROUND " + str(run.get("wins", 0)) + " COMPLETE!"
		wins_label.add_theme_color_override("font_color", ThemeManager.COLOR_SUCCESS_GREEN)
		fight_btn.text = "FIGHT NEXT"
		fight_btn.custom_minimum_size = Vector2(160, 30)
		fight_btn.visible = true
		back_btn.text = "End Run"
		back_btn.visible = true
	else:
		var w: int = int(run.get("wins", 0))
		wins_label.text = "LADDER OVER - " + str(w) + " WIN" + ("S" if w != 1 else "")
		wins_label.add_theme_color_override("font_color", ThemeManager.COLOR_HP_RED)
		fight_btn.visible = false
		back_btn.text = "Back to Ladder"
		back_btn.visible = true

	# Last fight stats panel
	var last_fight: Dictionary = {}
	var history: Array = run.get("history", [])
	if history.size() > 0:
		last_fight = history.back()
	if not last_fight.is_empty():
		var stats_panel := PanelContainer.new()
		_dynamic_container.add_child(stats_panel)
		var stats_vbox := VBoxContainer.new()
		stats_vbox.add_theme_constant_override("separation", 1)
		stats_panel.add_child(stats_vbox)
		var won_it: bool = last_fight.get("won", false)
		if won_it:
			var hp_pct := roundi(float(last_fight.get("player_hp_left", 0)) / maxf(1.0, float(last_fight.get("player_max_hp", 1))) * 100.0)
			var hp_col := ThemeManager.COLOR_SUCCESS_GREEN if hp_pct > 30 else ThemeManager.COLOR_HP_RED
			_add_label(stats_vbox, "WON vs " + str(last_fight.get("name", "?")), 8, ThemeManager.COLOR_SUCCESS_GREEN)
			_add_label(stats_vbox, "HP left: " + str(last_fight.get("player_hp_left", 0)) + " (" + str(hp_pct) + "%)", 8, hp_col)
		else:
			_add_label(stats_vbox, "LOST vs " + str(last_fight.get("name", "?")), 8, ThemeManager.COLOR_HP_RED)

	# Earned follower card with sprite
	if not earned_follower.is_empty():
		var earn_panel := PanelContainer.new()
		var rc: String = ThemeManager.RARITY_HEX.get(earned_follower.get("rarity", "common"), "#aaa")
		var rcol := Color.from_string(rc, Color.WHITE)
		var earn_sb := StyleBoxFlat.new()
		earn_sb.bg_color = Color(0.1, 0.1, 0.15)
		earn_sb.border_color = rcol
		earn_sb.set_border_width_all(2)
		earn_sb.set_corner_radius_all(3)
		earn_sb.set_content_margin_all(4)
		earn_panel.add_theme_stylebox_override("panel", earn_sb)
		_dynamic_container.add_child(earn_panel)

		var earn_hbox := HBoxContainer.new()
		earn_hbox.add_theme_constant_override("separation", 6)
		earn_panel.add_child(earn_hbox)

		# Follower sprite (64x64)
		var fname: String = str(earned_follower.get("name", "")).to_snake_case()
		var fpath := "res://assets/sprites/generated/followers/" + fname + ".png"
		if ResourceLoader.exists(fpath):
			var ftex = load(fpath)
			if ftex:
				var ficon := TextureRect.new()
				ficon.texture = ftex
				ficon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
				ficon.expand_mode = TextureRect.EXPAND_FIT_HEIGHT_PROPORTIONAL
				ficon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
				ficon.custom_minimum_size = Vector2(64, 64)
				earn_hbox.add_child(ficon)

		var earn_vbox := VBoxContainer.new()
		earn_vbox.add_theme_constant_override("separation", 1)
		earn_hbox.add_child(earn_vbox)
		_add_label(earn_vbox, "NEW FOLLOWER!", 8, ThemeManager.COLOR_GOLD_BRIGHT)
		_add_label(earn_vbox, str(earned_follower.get("name", "?")) + " (" + str(earned_follower.get("rarity", "?")) + ")", 8, rcol)
		var buff_desc: String = str(earned_follower.get("buff_desc", ""))
		if buff_desc != "":
			_add_label(earn_vbox, buff_desc, 8, ThemeManager.COLOR_TEXT_DIM)
	elif won:
		var until_next: int = 3 - (int(run.get("wins", 0)) % 3)
		_add_label(_dynamic_container, "Next follower in " + str(until_next) + " win" + ("s" if until_next > 1 else ""), 8, ThemeManager.COLOR_TEXT_DIM)

	# Bracket history panel
	if history.size() > 0:
		var bracket_panel := PanelContainer.new()
		_dynamic_container.add_child(bracket_panel)
		var bracket_vbox := VBoxContainer.new()
		bracket_vbox.add_theme_constant_override("separation", 1)
		bracket_panel.add_child(bracket_vbox)
		_add_label(bracket_vbox, "BRACKET", 8, ThemeManager.COLOR_BORDER_GOLD)
		for entry in history:
			var color := ThemeManager.COLOR_SUCCESS_GREEN if entry.get("won", false) else ThemeManager.COLOR_HP_RED
			var mark := " W" if entry.get("won", false) else " L"
			_add_label(bracket_vbox, str(entry.get("name", "?")) + mark, 8, color)

	# Upcoming opponents (if won)
	if won:
		var seq := CombatConstants.LADDER_SEQUENCE
		var opp_idx: int = int(run.get("opponent_idx", 0))
		if opp_idx < seq.size():
			_add_label(_dynamic_container, "Next: " + _classes.get(seq[opp_idx], {}).get("name", seq[opp_idx]), 8, ThemeManager.COLOR_TEXT_LIGHT)
		else:
			var cnum := opp_idx - seq.size() + 1
			_add_label(_dynamic_container, "Next: Challenger #" + str(cnum), 8, ThemeManager.COLOR_TEXT_LIGHT)

	# Defeat sheet for loss
	if not won:
		_show_defeat_info()


func _show_defeat_info() -> void:
	var run: Dictionary = _gs.ladder_run
	var opp: Dictionary = _gs._ladder_opponent
	if opp.is_empty():
		return
	var info_str: String = ""
	if opp.get("is_generated", false):
		info_str = str(opp.get("name", "?")) + " | " + str(opp.get("hp", 0)) + " HP | " + str(opp.get("base_dmg", 0)) + " DMG | " + str(opp.get("base_as", 0)) + " AS | " + str(opp.get("def", 0)) + " DEF"
		var skill_names: Array[String] = []
		var skills: Array = opp.get("skills", [])
		for si in skills:
			if int(si) < _skills_data.size():
				skill_names.append(str(_skills_data[int(si)].get("name", "?")))
		var ult_i: int = int(opp.get("ultimate", -1))
		if ult_i >= 0 and ult_i < _ults_data.size():
			skill_names.append(str(_ults_data[ult_i].get("name", "?")) + " (Ult)")
		if skill_names.size() > 0:
			info_str += "\nSkills: " + ", ".join(skill_names)
	else:
		var class_key: String = opp.get("class_key", "")
		var cls: Dictionary = _classes.get(class_key, {})
		info_str = cls.get("name", class_key) + " | " + str(cls.get("hp", 0)) + " HP | " + str(cls.get("base_dmg", 0)) + " DMG"

	if info_str != "" and _dynamic_container:
		_add_label(_dynamic_container, "--- Opponent Info ---", 8, ThemeManager.COLOR_TEXT_DIM)
		_add_label(_dynamic_container, info_str, 8, ThemeManager.COLOR_TEXT_DIM)


func _continue_ladder() -> void:
	_gs.ladder_run["_previewed_next"] = {}
	_show_follower_pick()


func _quit_ladder() -> void:
	_gs.ladder_run = {}
	_gs._ladder_mode = false
	_gs._ladder_opponent = {}
	_gs._ladder_result = ""
	# Persist all progress (followers, ladder_wins)
	var persistence = get_node_or_null("/root/Persistence")
	if persistence:
		persistence.save_game()
	_show_picker()
