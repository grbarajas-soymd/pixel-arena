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


func _ready() -> void:
	back_btn.pressed.connect(_on_back)
	start_btn.pressed.connect(_on_start)

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
		btn.custom_minimum_size = Vector2(80, 18)
		btn.alignment = HORIZONTAL_ALIGNMENT_CENTER
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
		var tex_rect := TextureRect.new()
		tex_rect.texture = tex
		tex_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		tex_rect.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
		tex_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tex_rect.custom_minimum_size = Vector2(64, 64)
		preview_container.add_child(tex_rect)

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

	# Stats label
	var f := FileAccess.open("res://data/classes.json", FileAccess.READ)
	if f:
		var classes = JSON.parse_string(f.get_as_text())
		f.close()
		if classes is Dictionary and classes.has(class_key):
			var c: Dictionary = classes[class_key]
			var stats_label := Label.new()
			stats_label.text = "HP:" + str(c.get("hp", 0)) + " DMG:" + str(c.get("base_dmg", 0)) + " AS:" + str(c.get("base_as", 0)) + " DEF:" + str(c.get("def", 0))
			stats_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
			stats_label.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
			info_vbox.add_child(stats_label)


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
