class_name TutorialDialog
extends CanvasLayer
## Reusable bottom-anchored dialog popup for Dio, the burning egregore mentor.
## Shows a portrait, BBCode text with typewriter effect, and configurable buttons.

signal dialog_closed
signal option_selected(idx: int)

const DIALOG_Y := 258
const DIALOG_HEIGHT := 94
const DIALOG_MARGIN_X := 8
const PORTRAIT_SIZE := 56.0

const DIO_SPRITE_PATH := "res://assets/sprites/generated/npcs/dio_idle.png"

var _backdrop: ColorRect
var _panel: PanelContainer
var _text_label: RichTextLabel
var _buttons: Array[Button] = []
var _full_text: String = ""
var _typewriter_tween: Tween


func _ready() -> void:
	layer = 50


func show_dialog(text: String, buttons: Array = ["Continue"], mentor_name: String = "Dio") -> void:
	_cleanup()
	_full_text = text

	# Backdrop — lighter than full overlay so the scene behind stays visible
	_backdrop = ColorRect.new()
	_backdrop.color = Color(0, 0, 0, 0.35)
	_backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_backdrop.mouse_filter = Control.MOUSE_FILTER_STOP
	_backdrop.theme = get_tree().root.theme  # Inherit global theme into CanvasLayer
	add_child(_backdrop)

	# Panel at bottom of screen
	_panel = PanelContainer.new()
	var panel_style := ThemeManager.make_panel_style(0.97)
	panel_style.border_color = Color(0.9, 0.35, 0.1)  # Molten orange border
	panel_style.set_border_width_all(1)
	_panel.add_theme_stylebox_override("panel", panel_style)
	_panel.position = Vector2(DIALOG_MARGIN_X, DIALOG_Y)
	_panel.custom_minimum_size = Vector2(640 - DIALOG_MARGIN_X * 2, DIALOG_HEIGHT)
	_backdrop.add_child(_panel)

	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 8)
	_panel.add_child(hbox)

	# Dio portrait panel — molten inset
	var portrait_panel := PanelContainer.new()
	var inset := ThemeManager.make_inset_style()
	inset.border_color = Color(0.8, 0.3, 0.05)
	portrait_panel.add_theme_stylebox_override("panel", inset)
	portrait_panel.custom_minimum_size = Vector2(PORTRAIT_SIZE + 8, PORTRAIT_SIZE + 8)
	hbox.add_child(portrait_panel)

	# Try to load the Dio sprite; fall back to a molten glow placeholder
	var portrait_tex = load(DIO_SPRITE_PATH) if ResourceLoader.exists(DIO_SPRITE_PATH) else null
	if portrait_tex:
		var tex_rect := TextureRect.new()
		tex_rect.texture = portrait_tex
		tex_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		tex_rect.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
		tex_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tex_rect.custom_minimum_size = Vector2(PORTRAIT_SIZE, PORTRAIT_SIZE)
		tex_rect.position = Vector2(4, 4)
		portrait_panel.add_child(tex_rect)
	else:
		# Fallback: fiery glow rectangle with "DIO" text
		var glow := ColorRect.new()
		glow.color = Color(0.15, 0.05, 0.0)
		glow.custom_minimum_size = Vector2(PORTRAIT_SIZE, PORTRAIT_SIZE)
		glow.position = Vector2(4, 4)
		portrait_panel.add_child(glow)
		var glow_lbl := Label.new()
		glow_lbl.text = "DIO"
		glow_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["heading"])
		glow_lbl.add_theme_color_override("font_color", Color(1.0, 0.4, 0.1))
		glow_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		glow_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		glow_lbl.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		glow.add_child(glow_lbl)

	# Right side — name + text + buttons
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 2)
	vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(vbox)

	# Mentor name — fiery orange
	var name_label := Label.new()
	name_label.text = mentor_name
	name_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["heading"])
	name_label.add_theme_color_override("font_color", Color(1.0, 0.45, 0.1))
	vbox.add_child(name_label)

	# Dialog text (BBCode, typewriter)
	_text_label = RichTextLabel.new()
	_text_label.bbcode_enabled = true
	_text_label.text = text
	_text_label.fit_content = true
	_text_label.scroll_active = false
	_text_label.add_theme_font_size_override("normal_font_size", ThemeManager.FONT_SIZES["body"])
	# Remove default RichTextLabel background
	var empty_style := StyleBoxFlat.new()
	empty_style.bg_color = Color(0, 0, 0, 0)
	empty_style.set_border_width_all(0)
	empty_style.set_content_margin_all(0)
	_text_label.add_theme_stylebox_override("normal", empty_style)
	_text_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(_text_label)

	# Typewriter effect
	_text_label.visible_ratio = 0.0
	_typewriter_tween = create_tween()
	var char_count := _strip_bbcode(text).length()
	var duration := clampf(char_count * 0.018, 0.3, 2.5)
	_typewriter_tween.tween_property(_text_label, "visible_ratio", 1.0, duration)

	# Buttons row
	var btn_row := HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_END
	btn_row.add_theme_constant_override("separation", 6)
	vbox.add_child(btn_row)

	_buttons.clear()
	for i in range(buttons.size()):
		var btn := Button.new()
		btn.text = buttons[i]
		btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		ThemeManager.style_button(btn)
		var idx := i
		btn.pressed.connect(func():
			if _typewriter_tween and _typewriter_tween.is_running():
				skip_typewriter()
			else:
				option_selected.emit(idx)
				close()
		)
		btn_row.add_child(btn)
		_buttons.append(btn)


func close() -> void:
	if _typewriter_tween and _typewriter_tween.is_running():
		_typewriter_tween.kill()
	_cleanup()
	dialog_closed.emit()


func skip_typewriter() -> void:
	if _typewriter_tween and _typewriter_tween.is_running():
		_typewriter_tween.kill()
	if _text_label:
		_text_label.visible_ratio = 1.0


func _cleanup() -> void:
	if _typewriter_tween and _typewriter_tween.is_running():
		_typewriter_tween.kill()
	_typewriter_tween = null
	if _backdrop:
		_backdrop.queue_free()
		_backdrop = null
	_panel = null
	_text_label = null
	_buttons.clear()


## Strip BBCode tags to get plain text length for typewriter timing.
func _strip_bbcode(text: String) -> String:
	var regex := RegEx.new()
	regex.compile("\\[.*?\\]")
	return regex.sub(text, "", true)
