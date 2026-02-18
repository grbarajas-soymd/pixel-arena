extends Control
## Character Forge hub — 3-column layout: equipment | sprite | stats+skills.

@onready var title_label: Label = %Title
@onready var dust_label: Label = %DustLabel
@onready var gold_label: Label = %GoldLabel
@onready var left_panel: VBoxContainer = %LeftPanel
@onready var center_panel: VBoxContainer = %CenterPanel
@onready var right_panel: VBoxContainer = %RightPanel
@onready var dungeon_btn: Button = %DungeonBtn
@onready var ladder_btn: Button = %LadderBtn
@onready var arena_btn: Button = %ArenaBtn
@onready var item_picker_overlay: PanelContainer = %ItemPickerOverlay
@onready var item_picker_vbox: VBoxContainer = %ItemPickerVBox
@onready var skill_picker_overlay: PanelContainer = %SkillPickerOverlay
@onready var skill_picker_vbox: VBoxContainer = %SkillPickerVBox
@onready var craft_overlay: PanelContainer = %CraftOverlay
@onready var craft_vbox: VBoxContainer = %CraftVBox
@onready var craft_btn: Button = %CraftBtn
@onready var menu_btn: Button = %MenuBtn

var _gs: Node
var _idb: Node
var _fdb: Node
var _persistence: Node
var _skills_data: Array = []
var _ults_data: Array = []
var _picker_slot: String = ""
var _picker_type: String = ""  # "skill1", "skill2", "ultimate"

const EQUIP_SLOTS := ["weapon", "helmet", "chest", "boots", "accessory"]
const SLOT_LABELS := {"weapon": "W", "helmet": "H", "chest": "C", "boots": "B", "accessory": "A"}

const HERO_SPRITE_PATH := "res://assets/sprites/generated/heroes/"



func _ready() -> void:
	_gs = get_node("/root/GameState")
	_idb = get_node("/root/ItemDatabase")
	_fdb = get_node("/root/FollowerDatabase")
	_persistence = get_node("/root/Persistence")

	dungeon_btn.pressed.connect(_on_dungeon)
	ladder_btn.pressed.connect(_on_ladder)
	arena_btn.pressed.connect(_on_arena)
	craft_btn.pressed.connect(_open_craft_overlay)
	menu_btn.pressed.connect(func(): TransitionManager.fade_to_scene("res://scenes/main_menu/main_menu.tscn"))
	_gs.dust_changed.connect(func(_a): _update_currencies())
	_gs.gold_changed.connect(func(_a): _update_currencies())

	_load_skill_data()
	_setup_background()

	title_label.text = "FORGE"
	title_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])
	title_label.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)

	_build_left_panel()
	_build_center_panel()
	_build_right_panel()
	_update_currencies()


func _load_skill_data() -> void:
	var f := FileAccess.open("res://data/skills.json", FileAccess.READ)
	if f:
		var data = JSON.parse_string(f.get_as_text())
		f.close()
		if data is Dictionary:
			_skills_data = data.get("skills", [])
			_ults_data = data.get("ultimates", [])


func _setup_background() -> void:
	ThemeManager.setup_scene_background(self, "res://assets/tilesets/battle_backgrounds/dungeon_depths.png", Color(0.15, 0.15, 0.25, 1.0))


func _update_currencies() -> void:
	dust_label.text = "Dust: " + str(_gs.dust)
	gold_label.text = "Gold: " + str(_gs.gold)


# ============ LEFT PANEL: EQUIPMENT + GEAR BAG ============

func _build_left_panel() -> void:
	_clear_children(left_panel)

	# -- Equipment section in inset panel --
	var equip_header := Label.new()
	equip_header.text = "EQUIPMENT"
	equip_header.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	equip_header.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	left_panel.add_child(equip_header)

	var equip_panel := PanelContainer.new()
	equip_panel.add_theme_stylebox_override("panel", ThemeManager.make_inset_style())
	left_panel.add_child(equip_panel)

	var equip_vbox := VBoxContainer.new()
	equip_vbox.add_theme_constant_override("separation", 1)
	equip_panel.add_child(equip_vbox)

	for slot in EQUIP_SLOTS:
		var btn := Button.new()
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		btn.clip_text = true
		btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		btn.custom_minimum_size = Vector2(0, 14)
		var gear = _gs.equipment.get(slot, {})
		if gear and not gear.is_empty():
			var item_name: String = str(gear.get("name", slot.capitalize()))
			var rarity: String = str(gear.get("rarity", "common"))
			var affix_count: int = gear.get("affixes", []).size()
			var affix_tag: String = " [" + str(affix_count) + "A]" if affix_count > 0 else ""
			btn.text = SLOT_LABELS[slot] + ": " + item_name + affix_tag
			btn.add_theme_color_override("font_color", ThemeManager.get_rarity_color(rarity))
		else:
			btn.text = SLOT_LABELS[slot] + ": [empty]"
			btn.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
		btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		btn.pressed.connect(_open_item_picker.bind(slot))
		equip_vbox.add_child(btn)

	# -- Gear bag section in inset panel --
	var bag_header := Label.new()
	bag_header.text = "GEAR BAG (" + str(_gs.gear_bag.size()) + ")"
	bag_header.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	bag_header.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	left_panel.add_child(bag_header)

	var bag_panel := PanelContainer.new()
	bag_panel.add_theme_stylebox_override("panel", ThemeManager.make_inset_style())
	bag_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left_panel.add_child(bag_panel)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bag_panel.add_child(scroll)

	var bag_vbox := VBoxContainer.new()
	bag_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bag_vbox.add_theme_constant_override("separation", 1)
	scroll.add_child(bag_vbox)

	for i in range(_gs.gear_bag.size()):
		var item: Dictionary = _gs.gear_bag[i]
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 2)
		var lbl := Label.new()
		var item_name: String = str(item.get("name", "?"))
		var rarity: String = str(item.get("rarity", "common"))
		lbl.text = item_name
		lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		lbl.add_theme_color_override("font_color", ThemeManager.get_rarity_color(rarity))
		lbl.clip_text = true
		lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(lbl)
		var salvage_val: int = _idb.get_salvage_value(item)
		var dust_btn := Button.new()
		dust_btn.text = "+" + str(salvage_val)
		dust_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		dust_btn.custom_minimum_size = Vector2(28, 12)
		dust_btn.pressed.connect(_salvage_gear.bind(i))
		row.add_child(dust_btn)
		bag_vbox.add_child(row)

	if _gs.gear_bag.is_empty():
		var empty_lbl := Label.new()
		empty_lbl.text = "(empty)"
		empty_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		empty_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
		bag_vbox.add_child(empty_lbl)


# ============ CENTER PANEL: SPRITE + NAME ============

func _build_center_panel() -> void:
	_clear_children(center_panel)

	# Hero name
	var name_label := Label.new()
	name_label.text = _gs.custom_char.get("name", "Hero")
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])
	name_label.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_WHITE)
	center_panel.add_child(name_label)

	# Class label
	var class_key: String = _gs.custom_char.get("class_key", "barbarian")
	var class_label := Label.new()
	class_label.text = class_key.capitalize()
	class_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	class_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	class_label.add_theme_color_override("font_color", ThemeManager.get_class_color(class_key))
	center_panel.add_child(class_label)

	# Hero sprite in a class-colored bordered panel
	var sprite_panel := PanelContainer.new()
	var sprite_style := ThemeManager.make_inset_style()
	sprite_style.border_color = ThemeManager.get_class_color(class_key)
	sprite_panel.add_theme_stylebox_override("panel", sprite_style)
	sprite_panel.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	center_panel.add_child(sprite_panel)

	var sprite_tex = load(HERO_SPRITE_PATH + class_key + "_base.png")
	if sprite_tex:
		var tex_rect := TextureRect.new()
		tex_rect.texture = sprite_tex
		tex_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		tex_rect.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
		tex_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tex_rect.custom_minimum_size = Vector2(100, 100)
		sprite_panel.add_child(tex_rect)
	else:
		var placeholder := Control.new()
		placeholder.custom_minimum_size = Vector2(100, 100)
		sprite_panel.add_child(placeholder)

	# Follower section in inset panel
	var follower_header := Label.new()
	follower_header.text = "FOLLOWER"
	follower_header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	follower_header.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	follower_header.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	center_panel.add_child(follower_header)

	var follower_panel := PanelContainer.new()
	follower_panel.add_theme_stylebox_override("panel", ThemeManager.make_inset_style())
	follower_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	center_panel.add_child(follower_panel)

	var follower_content := VBoxContainer.new()
	follower_content.add_theme_constant_override("separation", 1)
	follower_panel.add_child(follower_content)

	if _gs.active_follower >= 0 and _gs.active_follower < _gs.followers.size():
		var fl: Dictionary = _gs.followers[_gs.active_follower]
		var fl_label := Label.new()
		fl_label.text = str(fl.get("name", "?"))
		fl_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		fl_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		follower_content.add_child(fl_label)
		var change_btn := Button.new()
		change_btn.text = "Change"
		change_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		change_btn.pressed.connect(_cycle_follower)
		change_btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		follower_content.add_child(change_btn)
	elif _gs.followers.size() > 0:
		var pick_fl_btn := Button.new()
		pick_fl_btn.text = "Set Follower"
		pick_fl_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		pick_fl_btn.pressed.connect(_cycle_follower)
		pick_fl_btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		follower_content.add_child(pick_fl_btn)
	else:
		var no_fl := Label.new()
		no_fl.text = "(none)"
		no_fl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		no_fl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		no_fl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
		follower_content.add_child(no_fl)



# ============ RIGHT PANEL: STATS + SKILLS ============

var _stats_vbox: VBoxContainer = null

func _build_right_panel() -> void:
	_clear_children(right_panel)

	var stats: Dictionary = _gs.get_total_stats()

	# -- Stats section in inset panel --
	var stats_header := Label.new()
	stats_header.text = "STATS"
	stats_header.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	stats_header.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	right_panel.add_child(stats_header)

	var stats_panel := PanelContainer.new()
	stats_panel.add_theme_stylebox_override("panel", ThemeManager.make_inset_style())
	stats_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right_panel.add_child(stats_panel)

	_stats_vbox = VBoxContainer.new()
	_stats_vbox.add_theme_constant_override("separation", 1)
	stats_panel.add_child(_stats_vbox)

	_add_stat_line("HP", str(roundi(float(stats.get("hp", 0)))), Color(0.3, 0.85, 0.3))
	_add_stat_line("DMG", str(roundi(float(stats.get("base_dmg", 0)))), Color(0.9, 0.4, 0.3))
	_add_stat_line("AS", str(snappedf(float(stats.get("base_as", 0)), 0.01)), Color(0.9, 0.8, 0.3))
	_add_stat_line("DEF", str(roundi(float(stats.get("def", 0)))), Color(0.4, 0.6, 0.9))
	var eva_pct := roundi(float(stats.get("evasion", 0)) * 100.0)
	_add_stat_line("EVA", str(eva_pct) + "%", Color(0.6, 0.85, 0.85))
	_add_stat_line("SPD", str(roundi(float(stats.get("move_speed", 0)))), Color(0.7, 0.6, 0.9))

	# Extra stats if present
	if float(stats.get("mana", 0)) > 0:
		_add_stat_line("MANA", str(roundi(float(stats.get("mana", 0)))), ThemeManager.COLOR_MANA_BLUE)
	if float(stats.get("spell_dmg_bonus", 0)) > 0:
		_add_stat_line("SPELL", "+" + str(roundi(float(stats.get("spell_dmg_bonus", 0)) * 100)) + "%", Color(0.6, 0.4, 0.9))
	# Affix-derived stats
	if float(stats.get("crit_chance", 0)) > 0:
		_add_stat_line("CRIT", str(roundi(float(stats.get("crit_chance", 0)) * 100)) + "%", Color(0.9, 0.6, 0.2))
	if float(stats.get("lifesteal", 0)) > 0:
		_add_stat_line("STEAL", str(roundi(float(stats.get("lifesteal", 0)) * 100)) + "%", Color(0.8, 0.2, 0.3))
	if float(stats.get("thorns_reflect", 0)) > 0:
		_add_stat_line("THRN", str(roundi(float(stats.get("thorns_reflect", 0)) * 100)) + "%", Color(0.6, 0.6, 0.3))
	if int(stats.get("hp_regen", 0)) > 0:
		_add_stat_line("REGEN", "+" + str(int(stats.get("hp_regen", 0))), Color(0.3, 0.85, 0.5))
	if float(stats.get("dmg_reduction", 0)) > 0:
		_add_stat_line("DR", str(roundi(float(stats.get("dmg_reduction", 0)) * 100)) + "%", Color(0.4, 0.5, 0.8))
	if float(stats.get("fire_dmg", 0)) > 0:
		_add_stat_line("FIRE", "+" + str(roundi(float(stats.get("fire_dmg", 0)) * 100)) + "%", Color(0.9, 0.4, 0.1))
	if float(stats.get("ice_dmg", 0)) > 0:
		_add_stat_line("ICE", "+" + str(roundi(float(stats.get("ice_dmg", 0)) * 100)) + "%", Color(0.3, 0.7, 0.9))
	if float(stats.get("lightning_dmg", 0)) > 0:
		_add_stat_line("LGHT", "+" + str(roundi(float(stats.get("lightning_dmg", 0)) * 100)) + "%", Color(0.8, 0.8, 0.3))

	_stats_vbox = null  # Clear reference after building

	# -- Skills section in inset panel --
	var skills_header := Label.new()
	skills_header.text = "SKILLS"
	skills_header.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	skills_header.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	right_panel.add_child(skills_header)

	var skills_panel := PanelContainer.new()
	skills_panel.add_theme_stylebox_override("panel", ThemeManager.make_inset_style())
	skills_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right_panel.add_child(skills_panel)

	var skills_vbox := VBoxContainer.new()
	skills_vbox.add_theme_constant_override("separation", 1)
	skills_panel.add_child(skills_vbox)

	var char_skills: Array = _gs.custom_char.get("skills", [])
	var char_ult: int = int(_gs.custom_char.get("ultimate", -1))

	# Skill 1
	var s1_btn := Button.new()
	s1_btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
	s1_btn.clip_text = true
	s1_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s1_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	if char_skills.size() > 0 and int(char_skills[0]) < _skills_data.size():
		s1_btn.text = "S1: " + str(_skills_data[int(char_skills[0])].get("name", "?"))
	else:
		s1_btn.text = "S1: [pick]"
	s1_btn.pressed.connect(_open_skill_picker.bind("skill1"))
	skills_vbox.add_child(s1_btn)

	# Skill 2
	var s2_btn := Button.new()
	s2_btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
	s2_btn.clip_text = true
	s2_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s2_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	if char_skills.size() > 1 and int(char_skills[1]) < _skills_data.size():
		s2_btn.text = "S2: " + str(_skills_data[int(char_skills[1])].get("name", "?"))
	else:
		s2_btn.text = "S2: [pick]"
	s2_btn.pressed.connect(_open_skill_picker.bind("skill2"))
	skills_vbox.add_child(s2_btn)

	# Ultimate
	var ult_btn := Button.new()
	ult_btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
	ult_btn.clip_text = true
	ult_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ult_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	if char_ult >= 0 and char_ult < _ults_data.size():
		ult_btn.text = "ULT: " + str(_ults_data[char_ult].get("name", "?"))
	else:
		ult_btn.text = "ULT: [pick]"
	ult_btn.pressed.connect(_open_skill_picker.bind("ultimate"))
	skills_vbox.add_child(ult_btn)


func _add_stat_line(label: String, value: String, color: Color) -> void:
	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 2)

	var name_lbl := Label.new()
	name_lbl.text = label + ":"
	name_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	name_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	name_lbl.custom_minimum_size = Vector2(36, 0)
	hbox.add_child(name_lbl)

	var val_lbl := Label.new()
	val_lbl.text = value
	val_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	val_lbl.add_theme_color_override("font_color", color)
	hbox.add_child(val_lbl)

	if _stats_vbox:
		_stats_vbox.add_child(hbox)
	else:
		right_panel.add_child(hbox)


# ============ ITEM PICKER ============

func _open_item_picker(slot: String) -> void:
	_picker_slot = slot
	_clear_children(item_picker_vbox)

	var header := Label.new()
	header.text = "Equip " + slot.capitalize()
	header.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])
	header.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	item_picker_vbox.add_child(header)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	item_picker_vbox.add_child(scroll)

	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 2)
	scroll.add_child(list)

	# Unequip option
	var current_gear = _gs.equipment.get(slot, {})
	if current_gear and not current_gear.is_empty():
		var unequip_btn := Button.new()
		unequip_btn.text = "-- Unequip --"
		unequip_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		unequip_btn.add_theme_color_override("font_color", ThemeManager.COLOR_ERROR_RED)
		unequip_btn.pressed.connect(_equip_item.bind(-1))
		list.add_child(unequip_btn)

	# Show matching items from gear bag
	for i in range(_gs.gear_bag.size()):
		var item: Dictionary = _gs.gear_bag[i]
		var item_slot: String = str(item.get("slot", ""))
		if item_slot != slot:
			continue
		var item_row := VBoxContainer.new()
		item_row.add_theme_constant_override("separation", 0)
		var btn := Button.new()
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		var item_name: String = str(item.get("name", "?"))
		var rarity: String = str(item.get("rarity", "common"))
		var item_stats: Dictionary = item.get("stats", {})
		var stat_parts: Array[String] = []
		for sk in item_stats:
			stat_parts.append(str(sk) + ":" + str(item_stats[sk]))
		btn.text = item_name + " [" + ", ".join(stat_parts) + "]"
		btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		btn.add_theme_color_override("font_color", ThemeManager.get_rarity_color(rarity))
		btn.pressed.connect(_equip_item.bind(i))
		item_row.add_child(btn)
		# Show affixes if present
		var affixes: Array = item.get("affixes", [])
		if not affixes.is_empty():
			for affix in affixes:
				var a_lbl := Label.new()
				a_lbl.text = "  + " + str(affix.get("name", "")) + ": " + str(affix.get("desc", ""))
				a_lbl.add_theme_font_size_override("font_size", 6)
				a_lbl.add_theme_color_override("font_color", Color("#ffd700"))
				item_row.add_child(a_lbl)
		list.add_child(item_row)

	# Close button
	var close_btn := Button.new()
	close_btn.text = "Cancel"
	close_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	close_btn.pressed.connect(_close_item_picker)
	item_picker_vbox.add_child(close_btn)

	item_picker_overlay.visible = true


func _equip_item(bag_index: int) -> void:
	var slot: String = _picker_slot
	var current_gear = _gs.equipment.get(slot, {})

	if bag_index == -1:
		# Unequip
		if current_gear and not current_gear.is_empty():
			_gs.gear_bag.append(current_gear)
			_gs.equipment.erase(slot)
	else:
		# Swap
		var new_gear: Dictionary = _gs.gear_bag[bag_index]
		_gs.gear_bag.remove_at(bag_index)
		if current_gear and not current_gear.is_empty():
			_gs.gear_bag.append(current_gear)
		_gs.equipment[slot] = new_gear

	_close_item_picker()
	_rebuild_all()
	_persistence.save_game()


func _close_item_picker() -> void:
	item_picker_overlay.visible = false


# ============ SKILL PICKER ============

func _open_skill_picker(picker_type: String) -> void:
	_picker_type = picker_type
	_clear_children(skill_picker_vbox)

	var is_ult: bool = picker_type == "ultimate"
	var data_list: Array = _ults_data if is_ult else _skills_data

	var header := Label.new()
	header.text = "Pick Ultimate" if is_ult else "Pick Skill"
	header.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])
	header.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	skill_picker_vbox.add_child(header)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	skill_picker_vbox.add_child(scroll)

	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 1)
	scroll.add_child(list)

	for i in range(data_list.size()):
		var skill: Dictionary = data_list[i]
		var row := VBoxContainer.new()
		row.add_theme_constant_override("separation", 0)
		var btn := Button.new()
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		var skill_name: String = str(skill.get("name", "?"))
		var cd_sec: float = float(skill.get("bcd", 0)) / 1000.0
		var cost: int = int(skill.get("cost", 0))
		var label_text: String = skill_name
		if cd_sec > 0:
			label_text += " (" + str(cd_sec) + "s"
			if cost > 0:
				label_text += ", " + str(cost) + " cost"
			label_text += ")"
		btn.text = label_text
		btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		btn.pressed.connect(_select_skill.bind(i))
		row.add_child(btn)
		# Show dual descriptions when they differ
		var d_desc: String = str(skill.get("dungeon_desc", ""))
		var a_desc: String = str(skill.get("arena_desc", ""))
		if not d_desc.is_empty() and not a_desc.is_empty():
			var d_lbl := Label.new()
			d_lbl.text = "  DG: " + d_desc
			d_lbl.add_theme_font_size_override("font_size", 6)
			d_lbl.add_theme_color_override("font_color", Color(0.5, 0.7, 0.5))
			d_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD
			row.add_child(d_lbl)
			var a_lbl := Label.new()
			a_lbl.text = "  PVP: " + a_desc
			a_lbl.add_theme_font_size_override("font_size", 6)
			a_lbl.add_theme_color_override("font_color", Color(0.5, 0.5, 0.7))
			a_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD
			row.add_child(a_lbl)
		else:
			var desc: String = str(skill.get("desc", ""))
			if not desc.is_empty():
				var desc_lbl := Label.new()
				desc_lbl.text = "  " + desc
				desc_lbl.add_theme_font_size_override("font_size", 6)
				desc_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
				desc_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD
				row.add_child(desc_lbl)
		list.add_child(row)

	var close_btn := Button.new()
	close_btn.text = "Cancel"
	close_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	close_btn.pressed.connect(_close_skill_picker)
	skill_picker_vbox.add_child(close_btn)

	skill_picker_overlay.visible = true


func _select_skill(index: int) -> void:
	if _picker_type == "ultimate":
		_gs.custom_char["ultimate"] = index
	elif _picker_type == "skill1":
		if not _gs.custom_char.has("skills"):
			_gs.custom_char["skills"] = [0, 1]
		var skills: Array = _gs.custom_char["skills"]
		if skills.size() > 0:
			skills[0] = index
		else:
			skills.append(index)
		_gs.custom_char["skills"] = skills
	elif _picker_type == "skill2":
		if not _gs.custom_char.has("skills"):
			_gs.custom_char["skills"] = [0, 1]
		var skills: Array = _gs.custom_char["skills"]
		if skills.size() > 1:
			skills[1] = index
		elif skills.size() == 1:
			skills.append(index)
		else:
			skills.append(0)
			skills.append(index)
		_gs.custom_char["skills"] = skills

	_close_skill_picker()
	_build_right_panel()
	_persistence.save_game()


func _close_skill_picker() -> void:
	skill_picker_overlay.visible = false


# ============ FOLLOWER ============

func _cycle_follower() -> void:
	if _gs.followers.is_empty():
		return
	_gs.active_follower = (_gs.active_follower + 1) % _gs.followers.size()
	_build_center_panel()
	_build_right_panel()
	_persistence.save_game()


# ============ HELPERS ============

func _rebuild_all() -> void:
	_build_left_panel()
	_build_center_panel()
	_build_right_panel()


func _clear_children(node: Node) -> void:
	for child in node.get_children():
		child.queue_free()


# ============ GEAR SALVAGE ============

func _salvage_gear(bag_index: int) -> void:
	if bag_index < 0 or bag_index >= _gs.gear_bag.size():
		return
	var item: Dictionary = _gs.gear_bag[bag_index]
	var dust_val: int = _idb.get_salvage_value(item)
	_gs.gear_bag.remove_at(bag_index)
	_gs.add_dust(dust_val)
	_build_left_panel()
	_persistence.save_game()


# ============ CRAFT OVERLAY ============

func _open_craft_overlay() -> void:
	_build_craft_overlay()
	craft_overlay.visible = true


func _close_craft_overlay() -> void:
	craft_overlay.visible = false


func _build_craft_overlay() -> void:
	_clear_children(craft_vbox)

	var header := Label.new()
	header.text = "FOLLOWER FORGE"
	header.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])
	header.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	craft_vbox.add_child(header)

	var dust_info := Label.new()
	dust_info.text = "Dust: " + str(_gs.dust)
	dust_info.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	dust_info.add_theme_color_override("font_color", ThemeManager.COLOR_MANA_BLUE)
	dust_info.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	craft_vbox.add_child(dust_info)

	# Craft buttons
	var craft_row1 := HBoxContainer.new()
	craft_row1.alignment = BoxContainer.ALIGNMENT_CENTER
	craft_row1.add_theme_constant_override("separation", 4)
	craft_vbox.add_child(craft_row1)

	var rarities := ["common", "uncommon", "rare", "epic", "legendary"]
	var rarity_labels := ["Common", "Uncommon", "Rare", "Epic", "Legend"]
	for i in range(rarities.size()):
		var rarity: String = rarities[i]
		var cost: int = _fdb.get_craft_cost(rarity)
		var btn := Button.new()
		btn.text = rarity_labels[i] + " (" + str(cost) + ")"
		btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		btn.custom_minimum_size = Vector2(68, 20)
		btn.add_theme_color_override("font_color", ThemeManager.get_rarity_color(rarity))
		if _gs.dust < cost:
			btn.disabled = true
		btn.pressed.connect(_craft_follower.bind(rarity))
		craft_row1.add_child(btn)
		# Split into two rows for screen space
		if i == 1:
			var craft_row2 := HBoxContainer.new()
			craft_row2.alignment = BoxContainer.ALIGNMENT_CENTER
			craft_row2.add_theme_constant_override("separation", 4)
			craft_vbox.add_child(craft_row2)
			craft_row1 = craft_row2

	# Owned followers section
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.custom_minimum_size = Vector2(0, 80)
	craft_vbox.add_child(scroll)

	var follower_list := VBoxContainer.new()
	follower_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	follower_list.add_theme_constant_override("separation", 2)
	scroll.add_child(follower_list)

	var owned_header := Label.new()
	owned_header.text = "YOUR FOLLOWERS (" + str(_gs.followers.size()) + ")"
	owned_header.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	owned_header.add_theme_color_override("font_color", ThemeManager.COLOR_BORDER_GOLD)
	follower_list.add_child(owned_header)

	for i in range(_gs.followers.size()):
		var f: Dictionary = _gs.followers[i]
		var f_row := HBoxContainer.new()
		f_row.add_theme_constant_override("separation", 3)

		# Info label
		var rarity: String = str(f.get("rarity", "common"))
		var upgrades: int = int(f.get("upgrades", 0))
		var max_up: int = _fdb.get_max_upgrades()
		var stars := ""
		for s in range(max_up):
			stars += "+" if s < upgrades else "-"
		var info_lbl := Label.new()
		var f_name: String = str(f.get("name", "?"))
		info_lbl.text = f_name + " (" + rarity + ") " + stars
		info_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		info_lbl.add_theme_color_override("font_color", ThemeManager.get_rarity_color(rarity))
		info_lbl.clip_text = true
		info_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		f_row.add_child(info_lbl)

		# Upgrade button
		var up_cost: int = _fdb.get_upgrade_cost()
		var up_btn := Button.new()
		up_btn.text = "Up(" + str(up_cost) + ")"
		up_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		up_btn.custom_minimum_size = Vector2(40, 16)
		if upgrades >= max_up or _gs.dust < up_cost:
			up_btn.disabled = true
		up_btn.pressed.connect(_upgrade_follower.bind(i))
		f_row.add_child(up_btn)

		# Dust button
		var dust_val: int = _fdb.get_dust_value(f)
		var dust_btn := Button.new()
		dust_btn.text = "+" + str(dust_val)
		dust_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		dust_btn.custom_minimum_size = Vector2(30, 16)
		dust_btn.pressed.connect(_dust_follower.bind(i))
		f_row.add_child(dust_btn)

		follower_list.add_child(f_row)

	if _gs.followers.is_empty():
		var empty := Label.new()
		empty.text = "(no followers)"
		empty.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		empty.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
		follower_list.add_child(empty)

	# Close button
	var close_btn := Button.new()
	close_btn.text = "Close"
	close_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	close_btn.custom_minimum_size = Vector2(60, 20)
	close_btn.pressed.connect(_close_craft_overlay)
	craft_vbox.add_child(close_btn)


func _craft_follower(rarity: String) -> void:
	var result: Dictionary = _fdb.craft_follower(rarity)
	if result.is_empty():
		return
	var tmpl: Dictionary = _fdb.get_template(str(result.get("template_name", "")))
	result["name"] = tmpl.get("name", result.get("template_name", "Unknown"))
	result["icon"] = tmpl.get("icon", "?")
	result["rarity"] = tmpl.get("rarity", rarity)
	result["buff"] = tmpl.get("buff", {}).duplicate(true)
	result["buff_desc"] = tmpl.get("buff_desc", "")
	result["ability_name"] = tmpl.get("ability_name", "")
	result["ability_desc"] = tmpl.get("ability_desc", "")
	result["id"] = str(Time.get_unix_time_from_system()) + "_" + str(randi())
	_gs.followers.append(result)
	_persistence.save_game()
	_build_craft_overlay()
	_build_center_panel()


func _upgrade_follower(idx: int) -> void:
	if idx < 0 or idx >= _gs.followers.size():
		return
	_fdb.upgrade_follower(_gs.followers[idx])
	_persistence.save_game()
	_build_craft_overlay()


func _dust_follower(idx: int) -> void:
	if idx < 0 or idx >= _gs.followers.size():
		return
	var f: Dictionary = _gs.followers[idx]
	var dust_val: int = _fdb.get_dust_value(f)
	_gs.followers.remove_at(idx)
	_gs.add_dust(dust_val)
	if _gs.active_follower >= _gs.followers.size():
		_gs.active_follower = maxi(0, _gs.followers.size() - 1)
	_persistence.save_game()
	_build_craft_overlay()
	_build_center_panel()


# ============ NAVIGATION ============

func _on_dungeon() -> void:
	TransitionManager.fade_to_scene("res://scenes/dungeon/dungeon.tscn")


func _on_ladder() -> void:
	TransitionManager.fade_to_scene("res://scenes/ladder/ladder.tscn")


func _on_arena() -> void:
	TransitionManager.fade_to_scene("res://scenes/arena/arena.tscn")
