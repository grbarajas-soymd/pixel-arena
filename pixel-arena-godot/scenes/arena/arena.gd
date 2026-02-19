extends Control
## Online Arena — port of src/modes/arena.js
## Register, upload builds, browse opponents, assign followers, fight PvP.

const TutorialDialogScene := preload("res://scenes/tutorial/tutorial_dialog.gd")

@onready var status_label: Label = %StatusLabel
@onready var reg_name_input: LineEdit = %RegNameInput
@onready var register_btn: Button = %RegisterBtn
@onready var upload_btn: Button = %UploadBtn
@onready var opponent_container: VBoxContainer = %OpponentContainer
@onready var follower_container: VBoxContainer = %FollowerContainer
@onready var fight_btn: Button = %FightBtn
@onready var back_btn: Button = %BackBtn

var _gs: Node
var _net: Node
var _hero_factory: HeroFactory
var _tutorial_dialog  # TutorialDialog instance

var _online_opponents: Array = []
var _selected_opponent_id: String = ""
var _champion_index: int = -1

var _skills_data: Array = []
var _ults_data: Array = []

const HERO_SPRITE_PATH := "res://assets/sprites/generated/heroes/"


func _ready() -> void:
	_gs = get_node("/root/GameState")
	_net = get_node("/root/Network")
	_hero_factory = HeroFactory.new()
	add_child(_hero_factory)
	_load_data()
	_setup_background()

	var sfx := get_node_or_null("/root/SfxManager")
	if sfx:
		sfx.play_context("menu")

	back_btn.pressed.connect(_on_back)
	ThemeManager.style_stone_button(back_btn)

	# Require login for arena
	if not _net.is_logged_in():
		_show_login_required()
		return

	# Stone texture on action buttons
	ThemeManager.style_stone_button(register_btn)
	ThemeManager.style_stone_button(upload_btn, ThemeManager.COLOR_ACCENT_TEAL)
	ThemeManager.style_stone_button(fight_btn, ThemeManager.COLOR_GOLD_BRIGHT)
	fight_btn.custom_minimum_size = Vector2(140, 28)

	register_btn.pressed.connect(_on_register)
	upload_btn.pressed.connect(_on_upload)
	fight_btn.pressed.connect(_on_fight)

	_net.register_complete.connect(_on_register_complete)
	_net.upload_complete.connect(_on_upload_result)
	_net.opponents_fetched.connect(_on_opponents_fetched)
	_net.network_error.connect(_on_network_error)

	# Auto-register arena player from auth username
	if _net.player_id.is_empty():
		_net.player_name = _net.auth_username
		_net.register(_net.auth_username)

	_update_controls()
	_update_follower_ui()

	# Auto-refresh opponents if registered
	if not _net.player_id.is_empty():
		_net.fetch_opponents()

	# Show arena tutorial on first visit
	if not _gs.arena_tutorial_completed:
		_show_arena_tutorial()


func _load_data() -> void:
	var sf := FileAccess.open("res://data/skills.json", FileAccess.READ)
	if sf:
		var sd = JSON.parse_string(sf.get_as_text())
		sf.close()
		if sd is Dictionary:
			_skills_data = sd.get("skills", [])
			_ults_data = sd.get("ultimates", [])


func _setup_background() -> void:
	var old_bg := $Background
	if old_bg:
		old_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var margin := $Margin
	if margin:
		margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var tex = load("res://assets/tilesets/battle_backgrounds/sky_citadel.png")
	if tex:
		var bg := TextureRect.new()
		bg.texture = tex
		bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
		bg.modulate = Color(0.15, 0.15, 0.30, 1.0)
		add_child(bg)
		move_child(bg, 1)

	var title := $Margin/VBox/Header/Title
	if title:
		title.add_theme_color_override("font_color", Color(0.7, 0.5, 1.0))
		title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])


func _update_controls() -> void:
	if _net.player_id.is_empty():
		# Not registered
		reg_name_input.visible = true
		register_btn.visible = true
		upload_btn.visible = false
		status_label.text = "Join the arena to fight other players!"
	else:
		# Registered
		reg_name_input.visible = false
		register_btn.visible = false
		upload_btn.visible = true
		status_label.text = "Playing as: " + _net.player_name


# ============ REGISTRATION ============

func _on_register() -> void:
	var display_name: String = reg_name_input.text.strip_edges()
	if display_name.is_empty():
		status_label.text = "Enter a display name!"
		return
	status_label.text = "Registering..."
	_net.player_name = display_name
	_net.register(display_name)


func _on_register_complete(player_id: String) -> void:
	status_label.text = "Registered! Uploading build..."
	_update_controls()
	# Auto-upload build after registration
	var build := _hero_factory.serialize_build()
	_net.upload_build(build)


# ============ BUILD UPLOAD ============

func _on_upload() -> void:
	status_label.text = "Uploading build..."
	var build := _hero_factory.serialize_build()
	_net.upload_build(build)


func _on_upload_result(success: bool) -> void:
	if success:
		status_label.text = "Build uploaded!"
		# Refresh opponents after upload
		var timer := get_tree().create_timer(0.5)
		timer.timeout.connect(func(): _net.fetch_opponents())
	else:
		status_label.text = "Upload failed"


# ============ OPPONENT LIST ============

func _on_opponents_fetched(opponents: Array) -> void:
	_online_opponents = opponents
	_build_opponent_cards()


func _build_opponent_cards() -> void:
	for child in opponent_container.get_children():
		child.queue_free()

	if _online_opponents.is_empty():
		if _net.player_id.is_empty():
			status_label.text = "Register to see online opponents."
		else:
			status_label.text = "No opponents. Upload build & invite a friend!"
		return

	status_label.text = str(_online_opponents.size()) + " opponent" + ("s" if _online_opponents.size() > 1 else "")

	for opp in _online_opponents:
		var opp_id: String = str(opp.get("playerId", ""))
		var ch: Dictionary = opp.get("character", {})
		var rec: Dictionary = opp.get("record", {"wins": 0, "losses": 0})
		var opp_name: String = str(opp.get("playerName", "Unknown"))
		var stats: Dictionary = ch.get("stats", {})
		var is_selected: bool = opp_id == _selected_opponent_id

		# Card panel
		var card_panel := PanelContainer.new()
		var card_style := ThemeManager.make_inset_style(0.9)
		if is_selected:
			card_style.border_color = ThemeManager.COLOR_GOLD_BRIGHT
		else:
			card_style.border_color = ThemeManager.COLOR_BORDER_DIM
		card_panel.add_theme_stylebox_override("panel", card_style)

		var card_hbox := HBoxContainer.new()
		card_hbox.add_theme_constant_override("separation", 6)
		card_panel.add_child(card_hbox)

		# Sprite in class-colored border
		var class_key: String = str(ch.get("class_key", "barbarian"))
		var safe_key := class_key if not class_key.is_empty() else "barbarian"
		var tex = load(HERO_SPRITE_PATH + safe_key + "_base.png")
		if tex:
			var sprite_border := PanelContainer.new()
			var sp_sb := StyleBoxFlat.new()
			sp_sb.bg_color = Color(0.1, 0.1, 0.15)
			sp_sb.border_color = ThemeManager.get_class_color(safe_key)
			sp_sb.set_border_width_all(2)
			sp_sb.set_corner_radius_all(2)
			sp_sb.set_content_margin_all(2)
			sprite_border.add_theme_stylebox_override("panel", sp_sb)
			var tex_rect := TextureRect.new()
			tex_rect.texture = tex
			tex_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
			tex_rect.expand_mode = TextureRect.EXPAND_FIT_HEIGHT_PROPORTIONAL
			tex_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			tex_rect.custom_minimum_size = Vector2(64, 64)
			sprite_border.add_child(tex_rect)
			card_hbox.add_child(sprite_border)

		# Info column
		var info_vbox := VBoxContainer.new()
		info_vbox.add_theme_constant_override("separation", 0)
		info_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		card_hbox.add_child(info_vbox)

		var name_lbl := Label.new()
		name_lbl.text = opp_name + " | " + str(ch.get("name", "?"))
		name_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		if is_selected:
			name_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_SUCCESS_GREEN)
		else:
			name_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
		name_lbl.clip_text = true
		info_vbox.add_child(name_lbl)

		var stats_lbl := Label.new()
		stats_lbl.text = str(roundi(float(stats.get("hp", 0)))) + "HP " + str(roundi(float(stats.get("base_dmg", 0)))) + "dmg " + str(snappedf(float(stats.get("base_as", 0)), 0.01)) + "AS " + str(roundi(float(stats.get("def", 0)))) + "DEF"
		stats_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		stats_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
		stats_lbl.clip_text = true
		info_vbox.add_child(stats_lbl)

		var rec_lbl := Label.new()
		rec_lbl.text = "W:" + str(rec.get("wins", 0)) + " L:" + str(rec.get("losses", 0))
		rec_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		rec_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
		info_vbox.add_child(rec_lbl)

		# Build skill icons + names row
		var skills: Array = ch.get("skills", [])
		var skill_row := HBoxContainer.new()
		skill_row.add_theme_constant_override("separation", 3)
		info_vbox.add_child(skill_row)

		for si in skills:
			var si_int := int(si)
			if si_int < _skills_data.size():
				var sk_data: Dictionary = _skills_data[si_int]
				var sk_id: String = str(sk_data.get("id", ""))
				var sk_icon: Texture2D = IconMap.get_skill_icon(sk_id) if sk_id != "" else null
				if sk_icon:
					var sk_rect := TextureRect.new()
					sk_rect.texture = sk_icon
					sk_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
					sk_rect.expand_mode = TextureRect.EXPAND_FIT_HEIGHT_PROPORTIONAL
					sk_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
					sk_rect.custom_minimum_size = Vector2(20, 20)
					skill_row.add_child(sk_rect)
				else:
					var sk_name_lbl := Label.new()
					sk_name_lbl.text = str(sk_data.get("name", "?"))
					sk_name_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
					sk_name_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_ACCENT_TEAL)
					skill_row.add_child(sk_name_lbl)

		var ult_i = ch.get("ultimate", null)
		if ult_i != null and int(ult_i) < _ults_data.size():
			var ult_data: Dictionary = _ults_data[int(ult_i)]
			var ult_id: String = str(ult_data.get("id", ""))
			var ult_icon: Texture2D = IconMap.get_skill_icon(ult_id) if ult_id != "" else null
			if ult_icon:
				var ult_rect := TextureRect.new()
				ult_rect.texture = ult_icon
				ult_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
				ult_rect.expand_mode = TextureRect.EXPAND_FIT_HEIGHT_PROPORTIONAL
				ult_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
				ult_rect.custom_minimum_size = Vector2(20, 20)
				skill_row.add_child(ult_rect)
			else:
				var ult_name_lbl := Label.new()
				ult_name_lbl.text = str(ult_data.get("name", "?")) + "(U)"
				ult_name_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
				ult_name_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
				skill_row.add_child(ult_name_lbl)

		# Make entire card clickable
		var click_btn := Button.new()
		click_btn.flat = true
		click_btn.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		click_btn.mouse_filter = Control.MOUSE_FILTER_STOP
		click_btn.pressed.connect(_select_opponent.bind(opp_id))
		card_panel.add_child(click_btn)

		opponent_container.add_child(card_panel)


func _select_opponent(opp_id: String) -> void:
	if _selected_opponent_id == opp_id:
		_selected_opponent_id = ""
	else:
		_selected_opponent_id = opp_id
	_build_opponent_cards()


# ============ FOLLOWER ASSIGNMENT ============

func _update_follower_ui() -> void:
	for child in follower_container.get_children():
		child.queue_free()

	if _gs.followers.is_empty():
		return

	# Champion section — single follower that buffs, debuffs enemy, fights, and is wagered
	var champ_label := Label.new()
	champ_label.text = "CHAMPION (required — buffs you, debuffs enemy, lost if defeated!)"
	champ_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	champ_label.add_theme_color_override("font_color", ThemeManager.COLOR_ERROR_RED)
	follower_container.add_child(champ_label)

	var champ_flow := HBoxContainer.new()
	champ_flow.add_theme_constant_override("separation", 3)
	follower_container.add_child(champ_flow)

	for i in range(_gs.followers.size()):
		var f: Dictionary = _gs.followers[i]
		var rarity_str: String = str(f.get("rarity", "common"))
		var is_selected: bool = (i == _champion_index)
		var accent: Color
		if is_selected:
			accent = Color(1.0, 0.5, 0.3)
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

		# Name + buff summary
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

		# Click handler
		var click_btn := Button.new()
		click_btn.flat = true
		click_btn.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		click_btn.mouse_filter = Control.MOUSE_FILTER_STOP
		click_btn.pressed.connect(_toggle_champion.bind(i))
		card.add_child(click_btn)

		champ_flow.add_child(card)


func _toggle_champion(idx: int) -> void:
	if _champion_index == idx:
		_champion_index = -1
	else:
		_champion_index = idx
	_update_follower_ui()


# ============ FIGHT ============

func _on_fight() -> void:
	if _selected_opponent_id.is_empty():
		status_label.text = "Select an opponent!"
		return

	# Require champion if player has followers
	if _champion_index < 0 and _gs.followers.size() > 0:
		status_label.text = "You must select a champion!"
		return

	# Find selected opponent data
	var opp_data: Dictionary = {}
	for opp in _online_opponents:
		if str(opp.get("playerId", "")) == _selected_opponent_id:
			opp_data = opp
			break
	if opp_data.is_empty():
		status_label.text = "Opponent not found!"
		return

	var ch: Dictionary = opp_data.get("character", {})

	# Set arena state on GameState — champion is both the staked wager AND the fighter
	_gs._arena_opponent_build = ch
	_gs._arena_fighters = [_champion_index] if _champion_index >= 0 else []
	_gs._arena_staked = {
		"index": _champion_index,
		"opponent_id": _selected_opponent_id,
		"result": "",
	}
	_gs._ladder_mode = false

	TransitionManager.fade_to_scene("res://scenes/battle/battle.tscn")


# ============ NAVIGATION ============

func _on_back() -> void:
	_gs._arena_opponent_build = {}
	_gs._arena_fighters = []
	_gs._arena_staked = {}
	TransitionManager.fade_to_scene("res://scenes/character_forge/character_forge.tscn")


func _show_login_required() -> void:
	reg_name_input.visible = false
	register_btn.visible = false
	upload_btn.visible = false
	fight_btn.visible = false
	follower_container.visible = false
	opponent_container.visible = false
	status_label.text = "Login required for Arena!\nUse Account on main menu."
	status_label.add_theme_color_override("font_color", ThemeManager.COLOR_ERROR_RED)


func _on_network_error(message: String) -> void:
	status_label.text = "Offline — play Dungeon or Ladder!"


# ============ ARENA TUTORIAL ============

func _show_arena_tutorial() -> void:
	_tutorial_dialog = TutorialDialogScene.new()
	add_child(_tutorial_dialog)
	_tutorial_dialog.show_dialog(
		"Welcome to the [color=#bb88ff]Online Arena[/color]! " +
		"Here you fight other players' builds in real-time combat. " +
		"[color=#ffda66]Upload[/color] your build, pick an opponent, then choose a " +
		"[color=#ff8844]Champion[/color] follower to wager. " +
		"Win and you keep your champion — lose and they're gone! " +
		"Your rating goes up with victories.",
		["Got it!"],
		"Commander Aldric"
	)
	_tutorial_dialog.option_selected.connect(_on_arena_tutorial_closed)


func _on_arena_tutorial_closed(_idx: int) -> void:
	if _tutorial_dialog:
		_tutorial_dialog.queue_free()
		_tutorial_dialog = null
	_gs.arena_tutorial_completed = true
	var persistence: Node = get_node("/root/Persistence")
	persistence.save_game()
