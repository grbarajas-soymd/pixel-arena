extends Control
## Main menu — New Game, Continue, Settings, Account, Guide.

const _PlayersGuide = preload("res://data/players_guide.gd")

@onready var new_game_btn: Button = %NewGameBtn
@onready var continue_btn: Button = %ContinueBtn
@onready var settings_btn: Button = %SettingsBtn
@onready var account_btn: Button = %AccountBtn
@onready var guide_btn: Button = %GuideBtn

var _gs: Node


func _ready() -> void:
	_gs = get_node("/root/GameState")
	new_game_btn.pressed.connect(_on_new_game)
	continue_btn.pressed.connect(_on_continue)
	settings_btn.pressed.connect(_on_settings)
	account_btn.pressed.connect(_on_account)
	guide_btn.pressed.connect(_on_guide)

	continue_btn.disabled = _gs.slots.is_empty()

	_setup_background()
	_style_title()
	_update_account_btn()

	# Stone texture on all menu buttons
	for btn in [new_game_btn, continue_btn, settings_btn, account_btn, guide_btn]:
		ThemeManager.style_stone_button(btn)
		btn.custom_minimum_size = Vector2(260, 36)

	var net := get_node_or_null("/root/Network")
	if net:
		net.auth_login_complete.connect(func(_u: String): _update_account_btn())
		net.auth_signup_complete.connect(func(_u: String): _update_account_btn())
		net.auth_logout_complete.connect(func(): _update_account_btn())

	var sfx := get_node_or_null("/root/SfxManager")
	if sfx:
		sfx.play_context("menu")

	# Dio peeking — slides in from bottom-right after 2s, click to dismiss
	_spawn_dio_peeking()


func _spawn_dio_peeking() -> void:
	var dio_path := "res://assets/sprites/generated/npcs/dio_peeking.png"
	if not ResourceLoader.exists(dio_path):
		return
	var dio_tex: Texture2D = load(dio_path)
	if not dio_tex:
		return

	var dio := TextureRect.new()
	dio.texture = dio_tex
	dio.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	dio.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	dio.custom_minimum_size = Vector2(80, 80)
	dio.position = Vector2(960 - 80, 540)  # Start off-screen below bottom-right
	dio.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(dio)

	# Click to dismiss
	dio.gui_input.connect(func(event: InputEvent):
		if event is InputEventMouseButton and event.pressed:
			var tw := create_tween()
			tw.tween_property(dio, "position:y", 540.0, 0.3).set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_BACK)
			tw.tween_callback(dio.queue_free)
	)

	# Slide in after 2 seconds
	var tw := create_tween()
	tw.tween_interval(2.0)
	tw.tween_property(dio, "position:y", 540.0 - 80.0, 0.5).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)


func _setup_background() -> void:
	var bg_path = "res://assets/tilesets/battle_backgrounds/dark_forest.png"
	var tex = load(bg_path)
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

	var vignette = ColorRect.new()
	vignette.color = Color(0.0, 0.0, 0.0, 0.4)
	vignette.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(vignette)
	move_child(vignette, 1)


func _style_title() -> void:
	# Try to load a generated logo; fall back to styled text
	var logo_path := "res://assets/sprites/generated/ui/game_logo.png"
	var logo_tex: Texture2D = load(logo_path) if ResourceLoader.exists(logo_path) else null

	var title_label = $VBox/Title
	var subtitle = $VBox/Subtitle

	if logo_tex and title_label:
		# Replace text title with logo image
		title_label.visible = false
		if subtitle:
			subtitle.visible = false
		var logo := TextureRect.new()
		logo.texture = logo_tex
		logo.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		logo.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
		logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		logo.custom_minimum_size = Vector2(320, 107)
		logo.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		$VBox.add_child(logo)
		$VBox.move_child(logo, 0)
	elif title_label:
		# Text fallback — gold with dark blood-red shadow
		title_label.text = "Some of you\nmay die.."
		title_label.add_theme_color_override("font_color", Color(1.0, 0.85, 0.2))
		title_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["main_title"])
		title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

		var shadow = Label.new()
		shadow.text = title_label.text
		shadow.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		shadow.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["main_title"])
		shadow.add_theme_color_override("font_color", Color(0.6, 0.1, 0.1))
		shadow.position = title_label.position + Vector2(1, 1)
		shadow.size = title_label.size
		title_label.get_parent().add_child(shadow)
		title_label.get_parent().move_child(shadow, title_label.get_index())

		if subtitle:
			subtitle.visible = false


func _on_new_game() -> void:
	var persistence = get_node("/root/Persistence")
	if _gs.slots.size() >= persistence.MAX_SLOTS:
		_show_slots_full_dialog()
		return
	TransitionManager.fade_to_scene("res://scenes/class_select/class_select.tscn")


func _on_continue() -> void:
	if _gs.slots.is_empty():
		return
	if _gs.slots.size() == 1:
		var persistence = get_node("/root/Persistence")
		persistence.switch_to_slot(0)
		_route_to_destination()
	else:
		TransitionManager.fade_to_scene("res://scenes/character_select/character_select.tscn")


func _route_to_destination() -> void:
	if _gs._tutorial_return or not _gs.tutorial_completed:
		TransitionManager.fade_to_scene("res://scenes/tutorial/tutorial.tscn")
		return
	if _gs.has_active_run():
		TransitionManager.fade_to_scene("res://scenes/dungeon/dungeon.tscn")
		return
	TransitionManager.fade_to_scene("res://scenes/character_forge/character_forge.tscn")


func _show_slots_full_dialog() -> void:
	var overlay := ColorRect.new()
	overlay.color = ThemeManager.COLOR_OVERLAY_DIM
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(overlay)

	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", ThemeManager.make_ornate_panel_style())
	panel.position = Vector2(330, 200)
	panel.custom_minimum_size = Vector2(300, 120)
	overlay.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)
	panel.add_child(vbox)

	var msg := Label.new()
	msg.text = "All character slots are full."
	msg.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	msg.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
	msg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(msg)

	var btn_row := HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.add_theme_constant_override("separation", 8)
	vbox.add_child(btn_row)

	var manage_btn := Button.new()
	manage_btn.text = "Manage Characters"
	manage_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_stone_button(manage_btn)
	manage_btn.pressed.connect(func():
		overlay.queue_free()
		TransitionManager.fade_to_scene("res://scenes/character_select/character_select.tscn")
	)
	btn_row.add_child(manage_btn)

	var close := Button.new()
	close.text = "Cancel"
	close.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_stone_button(close)
	close.pressed.connect(func(): overlay.queue_free())
	btn_row.add_child(close)


# ============ SETTINGS POPUP ============

func _on_settings() -> void:
	var overlay := ColorRect.new()
	overlay.color = ThemeManager.COLOR_OVERLAY_DIM
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(overlay)

	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", ThemeManager.make_ornate_panel_style())
	panel.position = Vector2(330, 150)
	panel.size = Vector2(300, 220)
	overlay.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)
	panel.add_child(vbox)

	var title := Label.new()
	title.text = "SETTINGS"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])
	title.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	vbox.add_child(title)

	var sfx := get_node_or_null("/root/SfxManager")

	var music_row := HBoxContainer.new()
	music_row.add_theme_constant_override("separation", 4)
	vbox.add_child(music_row)
	var music_check := CheckButton.new()
	music_check.text = "Music"
	music_check.button_pressed = _gs.music_enabled
	music_check.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	music_row.add_child(music_check)
	var music_slider := HSlider.new()
	music_slider.min_value = 0
	music_slider.max_value = 100
	music_slider.value = _gs.music_volume * 100.0
	music_slider.custom_minimum_size = Vector2(80, 10)
	music_slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	music_row.add_child(music_slider)

	var sfx_row := HBoxContainer.new()
	sfx_row.add_theme_constant_override("separation", 4)
	vbox.add_child(sfx_row)
	var sfx_check := CheckButton.new()
	sfx_check.text = "SFX"
	sfx_check.button_pressed = _gs.sfx_enabled
	sfx_check.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	sfx_row.add_child(sfx_check)
	var sfx_slider := HSlider.new()
	sfx_slider.min_value = 0
	sfx_slider.max_value = 100
	sfx_slider.value = _gs.sfx_volume * 100.0
	sfx_slider.custom_minimum_size = Vector2(80, 10)
	sfx_slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sfx_row.add_child(sfx_slider)

	var bug_btn := Button.new()
	bug_btn.text = "Report Bug"
	bug_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_stone_button(bug_btn, ThemeManager.COLOR_HP_RED)
	bug_btn.pressed.connect(func():
		overlay.queue_free()
		_open_bug_report()
	)
	vbox.add_child(bug_btn)

	var close_btn := Button.new()
	close_btn.text = "Close"
	close_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_stone_button(close_btn)
	vbox.add_child(close_btn)

	music_check.toggled.connect(func(on: bool):
		_gs.music_enabled = on
		if sfx:
			sfx.set_music_enabled(on)
	)
	music_slider.value_changed.connect(func(val: float):
		_gs.music_volume = val / 100.0
		if sfx:
			sfx.set_music_volume(val / 100.0)
	)
	sfx_check.toggled.connect(func(on: bool):
		_gs.sfx_enabled = on
		if sfx:
			sfx.set_sfx_enabled(on)
	)
	sfx_slider.value_changed.connect(func(val: float):
		_gs.sfx_volume = val / 100.0
		if sfx:
			sfx.set_sfx_volume(val / 100.0)
	)
	close_btn.pressed.connect(func():
		var pers := get_node_or_null("/root/Persistence")
		if pers:
			pers.save_game()
		overlay.queue_free()
	)


# ============ ACCOUNT POPUP ============

func _update_account_btn() -> void:
	var net := get_node_or_null("/root/Network")
	if net and net.is_logged_in():
		account_btn.text = net.auth_username
	else:
		account_btn.text = "Account"


func _on_account() -> void:
	var net := get_node_or_null("/root/Network")
	if not net:
		return

	var overlay := ColorRect.new()
	overlay.color = ThemeManager.COLOR_OVERLAY_DIM
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(overlay)

	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", ThemeManager.make_ornate_panel_style())
	panel.position = Vector2(330, 140)
	panel.size = Vector2(300, 260)
	overlay.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 4)
	panel.add_child(vbox)

	var title := Label.new()
	title.text = "ACCOUNT"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])
	title.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	vbox.add_child(title)

	if net.is_logged_in():
		_build_logged_in_panel(vbox, overlay, net)
	else:
		_build_login_panel(vbox, overlay, net)


func _build_logged_in_panel(vbox: VBoxContainer, overlay: ColorRect, net: Node) -> void:
	var user_label := Label.new()
	user_label.text = "Logged in as:"
	user_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	user_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	user_label.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	vbox.add_child(user_label)

	var name_label := Label.new()
	name_label.text = net.auth_username
	name_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_label.add_theme_color_override("font_color", ThemeManager.COLOR_BORDER_GOLD)
	vbox.add_child(name_label)

	var status_label := Label.new()
	status_label.text = ""
	status_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_label.add_theme_color_override("font_color", ThemeManager.COLOR_SUCCESS_GREEN)
	vbox.add_child(status_label)

	var sync_btn := Button.new()
	sync_btn.text = "Sync Cloud Save"
	sync_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_stone_button(sync_btn, ThemeManager.COLOR_ACCENT_TEAL)
	sync_btn.pressed.connect(func():
		status_label.text = "Syncing..."
		var pers := get_node_or_null("/root/Persistence")
		if pers:
			pers.sync_cloud_save()
	)
	vbox.add_child(sync_btn)

	var logout_btn := Button.new()
	logout_btn.text = "Logout"
	logout_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_stone_button(logout_btn, ThemeManager.COLOR_HP_RED)
	logout_btn.pressed.connect(func():
		net.logout()
		overlay.queue_free()
	)
	vbox.add_child(logout_btn)

	var close_btn := Button.new()
	close_btn.text = "Close"
	close_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_stone_button(close_btn)
	close_btn.pressed.connect(func(): overlay.queue_free())
	vbox.add_child(close_btn)


func _build_login_panel(vbox: VBoxContainer, overlay: ColorRect, net: Node) -> void:
	var is_signup := [false]

	var mode_label := Label.new()
	mode_label.text = "LOGIN"
	mode_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mode_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	mode_label.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	vbox.add_child(mode_label)

	var username_input := LineEdit.new()
	username_input.placeholder_text = "Username"
	username_input.max_length = 20
	username_input.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	username_input.custom_minimum_size = Vector2(180, 0)
	vbox.add_child(username_input)

	var password_input := LineEdit.new()
	password_input.placeholder_text = "Password"
	password_input.secret = true
	password_input.max_length = 64
	password_input.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	password_input.custom_minimum_size = Vector2(180, 0)
	vbox.add_child(password_input)

	var status_label := Label.new()
	status_label.text = ""
	status_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_label.add_theme_color_override("font_color", ThemeManager.COLOR_ERROR_RED)
	vbox.add_child(status_label)

	var btn_row := HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.add_theme_constant_override("separation", 4)
	vbox.add_child(btn_row)

	var submit_btn := Button.new()
	submit_btn.text = "Login"
	submit_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_stone_button(submit_btn, ThemeManager.COLOR_HP_GREEN)
	btn_row.add_child(submit_btn)

	var toggle_btn := Button.new()
	toggle_btn.text = "Sign Up"
	toggle_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_stone_button(toggle_btn)
	btn_row.add_child(toggle_btn)

	var close_btn := Button.new()
	close_btn.text = "Close"
	close_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_stone_button(close_btn)
	btn_row.add_child(close_btn)

	toggle_btn.pressed.connect(func():
		is_signup[0] = not is_signup[0]
		if is_signup[0]:
			mode_label.text = "SIGN UP"
			submit_btn.text = "Register"
			toggle_btn.text = "Login"
		else:
			mode_label.text = "LOGIN"
			submit_btn.text = "Login"
			toggle_btn.text = "Sign Up"
	)

	submit_btn.pressed.connect(func():
		var uname := username_input.text.strip_edges()
		var pw := password_input.text
		if uname.length() < 3:
			status_label.add_theme_color_override("font_color", ThemeManager.COLOR_ERROR_RED)
			status_label.text = "Username: 3+ chars"
			return
		if pw.length() < 6:
			status_label.add_theme_color_override("font_color", ThemeManager.COLOR_ERROR_RED)
			status_label.text = "Password: 6+ chars"
			return
		status_label.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
		status_label.text = "Connecting..."
		submit_btn.disabled = true
		if is_signup[0]:
			net.signup(uname, pw)
		else:
			net.login(uname, pw)
	)

	var on_success := func(_username: String):
		overlay.queue_free()
	var on_error := func(msg: String):
		status_label.add_theme_color_override("font_color", ThemeManager.COLOR_ERROR_RED)
		status_label.text = msg
		submit_btn.disabled = false

	net.auth_login_complete.connect(on_success)
	net.auth_signup_complete.connect(on_success)
	net.auth_error.connect(on_error)

	overlay.tree_exiting.connect(func():
		if net.auth_login_complete.is_connected(on_success):
			net.auth_login_complete.disconnect(on_success)
		if net.auth_signup_complete.is_connected(on_success):
			net.auth_signup_complete.disconnect(on_success)
		if net.auth_error.is_connected(on_error):
			net.auth_error.disconnect(on_error)
	)

	close_btn.pressed.connect(func(): overlay.queue_free())
	username_input.grab_focus()


# ============ GUIDE POPUP ============

func _on_guide() -> void:
	var sections: Array = _PlayersGuide.SECTIONS

	var overlay := ColorRect.new()
	overlay.color = ThemeManager.COLOR_OVERLAY_DIM
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(overlay)

	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", ThemeManager.make_ornate_panel_style())
	panel.position = Vector2(40, 20)
	panel.size = Vector2(880, 500)
	overlay.add_child(panel)

	var main_vbox := VBoxContainer.new()
	main_vbox.add_theme_constant_override("separation", 4)
	panel.add_child(main_vbox)

	# Header row
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 4)
	main_vbox.add_child(header)

	var title := Label.new()
	title.text = "PLAYER'S GUIDE"
	title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])
	title.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)

	var close_btn := Button.new()
	close_btn.text = "X"
	close_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_stone_button(close_btn, ThemeManager.COLOR_HP_RED)
	close_btn.pressed.connect(func(): overlay.queue_free())
	header.add_child(close_btn)

	# Content area: TOC sidebar + scroll content
	var content_row := HBoxContainer.new()
	content_row.add_theme_constant_override("separation", 4)
	content_row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	main_vbox.add_child(content_row)

	# TOC sidebar
	var toc_scroll := ScrollContainer.new()
	toc_scroll.custom_minimum_size = Vector2(90, 0)
	toc_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	content_row.add_child(toc_scroll)

	var toc_vbox := VBoxContainer.new()
	toc_vbox.add_theme_constant_override("separation", 2)
	toc_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	toc_scroll.add_child(toc_vbox)

	# Content scroll
	var content_scroll := ScrollContainer.new()
	content_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	content_row.add_child(content_scroll)

	var content_label := RichTextLabel.new()
	content_label.bbcode_enabled = true
	content_label.fit_content = true
	content_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content_label.add_theme_font_size_override("normal_font_size", ThemeManager.FONT_SIZES["body"])
	content_label.add_theme_font_size_override("bold_font_size", ThemeManager.FONT_SIZES["body"])
	var pixel_font: Font = ThemeManager.pixel_font if ThemeManager.pixel_font else null
	if pixel_font:
		content_label.add_theme_font_override("normal_font", pixel_font)
		content_label.add_theme_font_override("bold_font", pixel_font)
	content_scroll.add_child(content_label)

	# Track active button for highlighting
	var active_btn: Array = [null]  # wrapped in array for closure capture

	# Build TOC buttons
	for i in sections.size():
		var section: Dictionary = sections[i]
		var btn := Button.new()
		btn.text = section.get("title", "?")
		btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
		ThemeManager.style_stone_button(btn)
		btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var idx := i
		btn.pressed.connect(func():
			content_label.text = sections[idx].get("content", "")
			content_scroll.scroll_vertical = 0
			if active_btn[0] != null:
				active_btn[0].add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
			btn.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
			active_btn[0] = btn
		)
		toc_vbox.add_child(btn)

	# Show first section by default
	if not sections.is_empty():
		content_label.text = sections[0].get("content", "")
		var first_btn: Button = toc_vbox.get_child(0) as Button
		if first_btn:
			first_btn.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
			active_btn[0] = first_btn


# ============ BUG REPORT ============

func _open_bug_report() -> void:
	var BugReportOverlay := preload("res://scripts/ui/bug_report_overlay.gd")
	var overlay := BugReportOverlay.new()
	add_child(overlay)
	overlay.show_report()
