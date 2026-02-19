extends CanvasLayer
## Self-contained bug report popup — builds all UI in code.
## Captures screenshot + diagnostics and submits via Network autoload.

signal report_closed

var _backdrop: ColorRect
var _status_label: Label
var _submit_btn: Button
var _desc_edit: TextEdit
var _category_btn: OptionButton


func _ready() -> void:
	layer = 60


func show_report() -> void:
	_cleanup()

	_backdrop = ColorRect.new()
	_backdrop.color = Color(0, 0, 0, 0.5)
	_backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_backdrop.mouse_filter = Control.MOUSE_FILTER_STOP
	_backdrop.theme = get_tree().root.theme
	add_child(_backdrop)

	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", ThemeManager.make_ornate_panel_style())
	panel.position = Vector2(230, 80)
	panel.custom_minimum_size = Vector2(500, 380)
	_backdrop.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)
	panel.add_child(vbox)

	# Title
	var title := Label.new()
	title.text = "REPORT A BUG"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])
	title.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	vbox.add_child(title)

	vbox.add_child(ThemeManager.make_separator(ThemeManager.COLOR_BORDER_GOLD))

	# Category row
	var cat_row := HBoxContainer.new()
	cat_row.add_theme_constant_override("separation", 6)
	vbox.add_child(cat_row)

	var cat_label := Label.new()
	cat_label.text = "Category:"
	cat_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	cat_label.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
	cat_row.add_child(cat_label)

	_category_btn = OptionButton.new()
	_category_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	for cat in ["gameplay", "ui", "crash", "balance", "network", "other"]:
		_category_btn.add_item(cat)
	_category_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cat_row.add_child(_category_btn)

	# Description
	var desc_label := Label.new()
	desc_label.text = "Describe the issue:"
	desc_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	desc_label.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
	vbox.add_child(desc_label)

	_desc_edit = TextEdit.new()
	_desc_edit.placeholder_text = "What happened? What did you expect? Steps to reproduce..."
	_desc_edit.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	_desc_edit.custom_minimum_size = Vector2(0, 160)
	_desc_edit.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_desc_edit.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	vbox.add_child(_desc_edit)

	# Status
	_status_label = Label.new()
	_status_label.text = ""
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	_status_label.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	vbox.add_child(_status_label)

	# Buttons
	var btn_row := HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.add_theme_constant_override("separation", 8)
	vbox.add_child(btn_row)

	_submit_btn = Button.new()
	_submit_btn.text = "Submit Report"
	_submit_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	_submit_btn.custom_minimum_size = Vector2(120, 28)
	ThemeManager.style_stone_button(_submit_btn, ThemeManager.COLOR_SUCCESS_GREEN)
	_submit_btn.pressed.connect(_on_submit)
	btn_row.add_child(_submit_btn)

	var cancel_btn := Button.new()
	cancel_btn.text = "Cancel"
	cancel_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	cancel_btn.custom_minimum_size = Vector2(80, 28)
	ThemeManager.style_stone_button(cancel_btn, ThemeManager.COLOR_BORDER_DIM)
	cancel_btn.pressed.connect(close)
	btn_row.add_child(cancel_btn)


func _on_submit() -> void:
	var desc := _desc_edit.text.strip_edges()
	if desc.length() < 10:
		_status_label.add_theme_color_override("font_color", ThemeManager.COLOR_ERROR_RED)
		_status_label.text = "Please describe the issue (10+ characters)."
		return
	if desc.length() > 5000:
		_status_label.add_theme_color_override("font_color", ThemeManager.COLOR_ERROR_RED)
		_status_label.text = "Description too long (max 5000 characters)."
		return

	_submit_btn.disabled = true
	_status_label.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	_status_label.text = "Submitting..."

	var category: String = _category_btn.get_item_text(_category_btn.selected)
	var net := get_node_or_null("/root/Network")
	if not net:
		_status_label.add_theme_color_override("font_color", ThemeManager.COLOR_ERROR_RED)
		_status_label.text = "Network unavailable."
		_submit_btn.disabled = false
		return

	net.bug_report_submitted.connect(_on_report_result, CONNECT_ONE_SHOT)
	net.submit_bug_report(category, desc)


func _on_report_result(success: bool) -> void:
	if success:
		_status_label.add_theme_color_override("font_color", ThemeManager.COLOR_SUCCESS_GREEN)
		_status_label.text = "Report sent. Thank you."
		_submit_btn.visible = false
		get_tree().create_timer(1.5).timeout.connect(close)
	else:
		_status_label.add_theme_color_override("font_color", ThemeManager.COLOR_ERROR_RED)
		_status_label.text = "Failed to send — try again later."
		_submit_btn.disabled = false


func close() -> void:
	_cleanup()
	report_closed.emit()


func _cleanup() -> void:
	if _backdrop:
		_backdrop.queue_free()
		_backdrop = null
	_status_label = null
	_submit_btn = null
	_desc_edit = null
	_category_btn = null
