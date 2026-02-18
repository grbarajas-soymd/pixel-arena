extends Control
## Character slot picker — choose which champion to play, create new, or delete.

const HERO_SPRITE_PATH := "res://assets/sprites/generated/heroes/"

const CLASS_DISPLAY: Dictionary = {
	"wizard": "Wizard", "ranger": "Ranger",
	"assassin": "Assassin", "barbarian": "Barbarian",
}

var _gs: Node
var _persistence: Node
var _card_container: HBoxContainer


func _ready() -> void:
	_gs = get_node("/root/GameState")
	_persistence = get_node("/root/Persistence")
	_setup_background()
	_build_ui()


func _setup_background() -> void:
	var tex = load("res://assets/tilesets/battle_backgrounds/dark_forest.png")
	if tex:
		var bg := TextureRect.new()
		bg.texture = tex
		bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		bg.modulate = Color(0.12, 0.12, 0.25, 1.0)
		var old_bg = $Background
		if old_bg:
			old_bg.queue_free()
		add_child(bg)
		move_child(bg, 0)

	var vignette := ColorRect.new()
	vignette.color = Color(0.0, 0.0, 0.0, 0.4)
	vignette.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(vignette)
	move_child(vignette, 1)


func _build_ui() -> void:
	# Main layout
	var root_vbox := VBoxContainer.new()
	root_vbox.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root_vbox.add_theme_constant_override("separation", 8)
	add_child(root_vbox)

	# Spacer top
	var top_spacer := Control.new()
	top_spacer.custom_minimum_size = Vector2(0, 30)
	root_vbox.add_child(top_spacer)

	# Title
	var title := Label.new()
	title.text = "CHOOSE YOUR CHAMPION"
	title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])
	title.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	root_vbox.add_child(title)

	# Hint
	var hint := Label.new()
	hint.text = "Click a card to play"
	hint.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
	hint.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	root_vbox.add_child(hint)

	# Card row — centered horizontally
	var center_container := CenterContainer.new()
	center_container.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root_vbox.add_child(center_container)

	_card_container = HBoxContainer.new()
	_card_container.add_theme_constant_override("separation", 10)
	center_container.add_child(_card_container)

	_populate_cards()

	# Back button
	var btn_row := HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.custom_minimum_size = Vector2(0, 30)
	root_vbox.add_child(btn_row)

	var back_btn := Button.new()
	back_btn.text = "Back"
	back_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_button(back_btn)
	back_btn.pressed.connect(func():
		TransitionManager.fade_to_scene("res://scenes/main_menu/main_menu.tscn")
	)
	btn_row.add_child(back_btn)


func _populate_cards() -> void:
	# Clear existing cards
	for child in _card_container.get_children():
		child.queue_free()

	# Slot cards
	for i in range(_gs.slots.size()):
		_card_container.add_child(_build_slot_card(i, _gs.slots[i]))

	# "New Hero" card if under MAX_SLOTS
	if _gs.slots.size() < _persistence.MAX_SLOTS:
		_card_container.add_child(_build_new_hero_card())


func _build_slot_card(index: int, slot: Dictionary) -> PanelContainer:
	var class_key: String = slot.get("class_key", "barbarian")
	var char_name: String = slot.get("char_name", "Hero")
	var is_active: bool = (index == _gs.active_slot)

	var card := PanelContainer.new()
	var style := ThemeManager.make_panel_style()
	if is_active:
		style.border_color = ThemeManager.COLOR_BORDER_GOLD
		style.set_border_width_all(2)
	card.add_theme_stylebox_override("panel", style)
	card.custom_minimum_size = Vector2(120, 190)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 2)
	card.add_child(vbox)

	# Hero sprite
	var sprite_container := CenterContainer.new()
	sprite_container.custom_minimum_size = Vector2(120, 56)
	vbox.add_child(sprite_container)

	var tex = load(HERO_SPRITE_PATH + class_key + "_base.png")
	if tex:
		var tex_rect := TextureRect.new()
		tex_rect.texture = tex
		tex_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		tex_rect.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
		tex_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tex_rect.custom_minimum_size = Vector2(56, 56)
		tex_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
		sprite_container.add_child(tex_rect)

	# Name
	var name_lbl := Label.new()
	name_lbl.text = char_name
	name_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["heading"])
	name_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_WHITE)
	name_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(name_lbl)

	# Class
	var class_lbl := Label.new()
	class_lbl.text = CLASS_DISPLAY.get(class_key, class_key.capitalize())
	class_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	class_lbl.add_theme_color_override("font_color", ThemeManager.get_class_color(class_key))
	class_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(class_lbl)

	# Stats line: followers / gear
	var follower_count: int = slot.get("followers", []).size()
	var gear_count: int = slot.get("gear_bag", []).size()
	var info_lbl := Label.new()
	info_lbl.text = str(follower_count) + "f  " + str(gear_count) + "g"
	info_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
	info_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	info_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(info_lbl)

	# Status tags
	var tutorial_done: bool = slot.get("tutorial_completed", false)
	if not tutorial_done:
		var tag := Label.new()
		tag.text = "[TUTORIAL]"
		tag.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
		tag.add_theme_color_override("font_color", Color(1.0, 0.45, 0.1))
		tag.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		vbox.add_child(tag)

	# Last played time
	var saved_at: float = slot.get("saved_at", 0.0)
	if saved_at > 0:
		var time_lbl := Label.new()
		time_lbl.text = _format_time_ago(saved_at)
		time_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
		time_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
		time_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		vbox.add_child(time_lbl)

	# ── Action buttons ──
	var btn_row := HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.add_theme_constant_override("separation", 4)
	vbox.add_child(btn_row)

	var idx := index
	var play_btn := Button.new()
	play_btn.text = "Play" if not is_active else "Continue"
	play_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	play_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ThemeManager.style_button(play_btn)
	play_btn.pressed.connect(func(): _select_slot(idx))
	btn_row.add_child(play_btn)

	var del_btn := Button.new()
	del_btn.text = "Delete"
	del_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
	del_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ThemeManager.style_button(del_btn, ThemeManager.COLOR_HP_RED)
	del_btn.pressed.connect(func(): _show_delete_confirmation(idx, char_name))
	btn_row.add_child(del_btn)

	return card


func _build_new_hero_card() -> PanelContainer:
	var card := PanelContainer.new()
	card.add_theme_stylebox_override("panel", ThemeManager.make_inset_style())
	card.custom_minimum_size = Vector2(120, 180)

	var click_btn := Button.new()
	click_btn.flat = true
	click_btn.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	click_btn.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	click_btn.pressed.connect(_on_new_hero)
	card.add_child(click_btn)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 4)
	vbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(vbox)

	# Center vertically
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 50)
	vbox.add_child(spacer)

	var plus_lbl := Label.new()
	plus_lbl.text = "+"
	plus_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["main_title"])
	plus_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	plus_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	plus_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vbox.add_child(plus_lbl)

	var label := Label.new()
	label.text = "New Hero"
	label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	label.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vbox.add_child(label)

	return card


# ── Actions ──────────────────────────────────────────────────────────

func _select_slot(index: int) -> void:
	_persistence.switch_to_slot(index)
	_route_to_destination()


func _route_to_destination() -> void:
	if _gs._tutorial_return or not _gs.tutorial_completed:
		TransitionManager.fade_to_scene("res://scenes/tutorial/tutorial.tscn")
		return
	if _gs.has_active_run():
		TransitionManager.fade_to_scene("res://scenes/dungeon/dungeon.tscn")
		return
	TransitionManager.fade_to_scene("res://scenes/character_forge/character_forge.tscn")


func _on_new_hero() -> void:
	TransitionManager.fade_to_scene("res://scenes/class_select/class_select.tscn")


func _show_delete_confirmation(index: int, char_name: String) -> void:
	var overlay := ColorRect.new()
	overlay.color = ThemeManager.COLOR_OVERLAY_DIM
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(overlay)

	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", ThemeManager.make_panel_style())
	panel.position = Vector2(170, 120)
	panel.custom_minimum_size = Vector2(300, 90)
	overlay.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)
	panel.add_child(vbox)

	var msg := Label.new()
	msg.text = "Delete " + char_name + "?"
	msg.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["heading"])
	msg.add_theme_color_override("font_color", ThemeManager.COLOR_HP_RED)
	msg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(msg)

	var sub_msg := Label.new()
	sub_msg.text = "All progress will be lost forever."
	sub_msg.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	sub_msg.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	sub_msg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(sub_msg)

	var btn_row := HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.add_theme_constant_override("separation", 12)
	vbox.add_child(btn_row)

	var del_btn := Button.new()
	del_btn.text = "Delete"
	del_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_button(del_btn, ThemeManager.COLOR_HP_RED)
	del_btn.pressed.connect(func():
		overlay.queue_free()
		_persistence.delete_slot(index)
		if _gs.slots.is_empty():
			TransitionManager.fade_to_scene("res://scenes/main_menu/main_menu.tscn")
		else:
			_populate_cards()
	)
	btn_row.add_child(del_btn)

	var cancel_btn := Button.new()
	cancel_btn.text = "Cancel"
	cancel_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_button(cancel_btn)
	cancel_btn.pressed.connect(func(): overlay.queue_free())
	btn_row.add_child(cancel_btn)


# ── Helpers ──────────────────────────────────────────────────────────

func _format_time_ago(unix_time: float) -> String:
	var now := Time.get_unix_time_from_system()
	var diff := now - unix_time
	if diff < 60:
		return "just now"
	if diff < 3600:
		return str(int(diff / 60)) + "m ago"
	if diff < 86400:
		return str(int(diff / 3600)) + "h ago"
	return str(int(diff / 86400)) + "d ago"
