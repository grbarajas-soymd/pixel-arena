extends Control
## Class selection screen — pick a class and name before starting the game.

@onready var name_input: LineEdit = %NameInput
@onready var class_grid: GridContainer = %ClassGrid
@onready var preview_container: HBoxContainer = %PreviewContainer
@onready var back_btn: Button = %BackBtn
@onready var start_btn: Button = %StartBtn

var _selected_class: String = ""
var _class_buttons: Dictionary = {}

const HERO_SPRITE_PATH := "res://assets/sprites/generated/heroes/"

const CLASS_INFO: Dictionary = {
	"wizard": {"name": "Wizard", "desc": "Ranged caster. High spell damage, shields, lightning."},
	"ranger": {"name": "Ranger", "desc": "Ranged fighter. Fast attacks, pet summon, fire rain."},
	"assassin": {"name": "Assassin", "desc": "Melee burst. Stealth, poison, high evasion."},
	"barbarian": {"name": "Barbarian", "desc": "Melee tank. High HP/DEF, rage, charge."},
}

const CLASS_NAMES: Dictionary = {
	"wizard": "Voltaris",
	"ranger": "Pyralis",
	"assassin": "Glacier",
	"barbarian": "Gorath",
}

## Random name pools per class — dark fantasy themed.
const RANDOM_NAMES: Dictionary = {
	"wizard": ["Voltaris", "Aetheris", "Zephyrus", "Nocturn", "Calyx", "Mordain",
		"Thalos", "Vextri", "Omen", "Arcanum", "Sable", "Pyrrus", "Corvyn",
		"Nihilis", "Lumara", "Dusk", "Seraph", "Ravox", "Cindra", "Oberon"],
	"ranger": ["Pyralis", "Ashvane", "Briarthorn", "Ember", "Fennix", "Gloom",
		"Hawken", "Ironthorn", "Jaelin", "Kestrel", "Lynara", "Morrigan",
		"Nightfall", "Oryx", "Peregrine", "Quiver", "Raven", "Sylvaris", "Thornwood", "Wyldfire"],
	"assassin": ["Glacier", "Shade", "Nyx", "Vesper", "Wraith", "Obsidian",
		"Phantom", "Reaver", "Silque", "Toxis", "Umbra", "Venom",
		"Whisper", "Xero", "Zerith", "Dagger", "Mistveil", "Onyx", "Scourge", "Eclipse"],
	"barbarian": ["Gorath", "Grimjaw", "Brakkar", "Theron", "Uldren", "Havok",
		"Ragnar", "Skarr", "Tormund", "Vrukk", "Wulfgar", "Xandor",
		"Yngvar", "Zarkus", "Doomfist", "Ironfang", "Kruul", "Mordak", "Oblisk", "Praxis"],
}


func _ready() -> void:
	back_btn.pressed.connect(_on_back)
	start_btn.pressed.connect(_on_start)

	# Stone texture on Back and Start buttons
	ThemeManager.style_stone_button(back_btn)
	ThemeManager.style_stone_button(start_btn, ThemeManager.COLOR_HP_GREEN)

	# Add randomize button next to name input
	var name_row := name_input.get_parent()
	var rand_btn := Button.new()
	rand_btn.text = "Random"
	rand_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
	rand_btn.custom_minimum_size = Vector2(50, 0)
	ThemeManager.style_stone_button(rand_btn)
	rand_btn.pressed.connect(_randomize_name)
	name_row.add_child(rand_btn)

	# Wider name input
	name_input.custom_minimum_size.x = 160

	var sfx := get_node_or_null("/root/SfxManager")
	if sfx:
		sfx.play_context("menu")

	_setup_background()
	_build_class_buttons()

	# Default to barbarian
	_select_class("barbarian")

	var title = $VBox/Title
	if title:
		title.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
		title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])


func _setup_background() -> void:
	var tex = load("res://assets/tilesets/battle_backgrounds/castle_throne.png")
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


func _build_class_buttons() -> void:
	for class_key in ["wizard", "ranger", "assassin", "barbarian"]:
		var info: Dictionary = CLASS_INFO[class_key]
		var btn := Button.new()
		btn.text = info["name"]
		btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		btn.custom_minimum_size = Vector2(180, 32)
		btn.alignment = HORIZONTAL_ALIGNMENT_CENTER
		ThemeManager.style_stone_button(btn, ThemeManager.get_class_color(class_key))
		btn.pressed.connect(_select_class.bind(class_key))
		class_grid.add_child(btn)
		_class_buttons[class_key] = btn


func _select_class(class_key: String) -> void:
	_selected_class = class_key

	# Update button highlights
	for key in _class_buttons:
		var btn: Button = _class_buttons[key]
		if key == class_key:
			btn.add_theme_color_override("font_color", ThemeManager.COLOR_ACCENT_TEAL)
		else:
			btn.remove_theme_color_override("font_color")

	# Set default name if input is empty or is a default class name
	var current_name: String = name_input.text.strip_edges()
	var is_default := current_name.is_empty()
	for cn in CLASS_NAMES.values():
		if current_name == cn:
			is_default = true
			break
	if is_default:
		name_input.text = CLASS_NAMES.get(class_key, "Hero")

	# Update sprite preview
	_update_preview(class_key)


func _update_preview(class_key: String) -> void:
	for child in preview_container.get_children():
		child.queue_free()

	var tex = load(HERO_SPRITE_PATH + class_key + "_base.png")
	if tex:
		# Sprite in class-colored ornate border
		var sprite_border := PanelContainer.new()
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(0.1, 0.1, 0.15)
		sb.border_color = ThemeManager.get_class_color(class_key)
		sb.set_border_width_all(2)
		sb.set_corner_radius_all(3)
		sb.set_content_margin_all(4)
		sprite_border.add_theme_stylebox_override("panel", sb)
		var tex_rect := TextureRect.new()
		tex_rect.texture = tex
		tex_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		tex_rect.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
		tex_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tex_rect.custom_minimum_size = Vector2(128, 128)
		sprite_border.add_child(tex_rect)
		preview_container.add_child(sprite_border)

	# Info column: description + stats
	var info_vbox := VBoxContainer.new()
	info_vbox.add_theme_constant_override("separation", 2)
	preview_container.add_child(info_vbox)

	# Class description
	var info: Dictionary = CLASS_INFO.get(class_key, {})
	var desc_label := Label.new()
	desc_label.text = info.get("desc", "")
	desc_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	desc_label.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
	desc_label.autowrap_mode = TextServer.AUTOWRAP_WORD
	info_vbox.add_child(desc_label)

	# Stats display — organized with color per stat
	var f := FileAccess.open("res://data/classes.json", FileAccess.READ)
	if f:
		var classes = JSON.parse_string(f.get_as_text())
		f.close()
		if classes is Dictionary and classes.has(class_key):
			var c: Dictionary = classes[class_key]
			var stats_grid := GridContainer.new()
			stats_grid.columns = 4
			stats_grid.add_theme_constant_override("h_separation", 6)
			stats_grid.add_theme_constant_override("v_separation", 1)
			info_vbox.add_child(stats_grid)
			var stat_defs: Array = [
				["HP", str(c.get("hp", 0)), Color(0.3, 0.85, 0.3)],
				["DMG", str(c.get("base_dmg", 0)), Color(0.9, 0.4, 0.3)],
				["AS", str(c.get("base_as", 0)), Color(0.9, 0.8, 0.3)],
				["DEF", str(c.get("def", 0)), Color(0.4, 0.6, 0.9)],
			]
			for sd in stat_defs:
				var sl := Label.new()
				sl.text = str(sd[0]) + ":" + str(sd[1])
				sl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
				sl.add_theme_color_override("font_color", sd[2])
				stats_grid.add_child(sl)


func _randomize_name() -> void:
	var pool: Array = RANDOM_NAMES.get(_selected_class, RANDOM_NAMES["barbarian"])
	var current: String = name_input.text.strip_edges()
	# Pick a name different from the current one
	var name: String = pool[randi() % pool.size()]
	var attempts := 0
	while name == current and attempts < 5:
		name = pool[randi() % pool.size()]
		attempts += 1
	name_input.text = name


func _on_start() -> void:
	if _selected_class.is_empty():
		return
	var char_name: String = name_input.text.strip_edges()
	if char_name.is_empty():
		char_name = CLASS_NAMES.get(_selected_class, "Hero")

	var persistence = get_node("/root/Persistence")
	var slot_index: int = persistence.next_free_slot_index()
	persistence.create_character_slot(slot_index, _selected_class, char_name)
	TransitionManager.fade_to_scene("res://scenes/tutorial/tutorial.tscn")


func _on_back() -> void:
	TransitionManager.fade_to_scene("res://scenes/main_menu/main_menu.tscn")
