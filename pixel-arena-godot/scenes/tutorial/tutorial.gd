extends Control
## Interactive tutorial — Dio the Egregore sends his latest champion into battle.
## Irreverent, GLaDOS-style humor. Launches after class selection.
## Teaches gear, skills, followers, then real dungeon and ladder fights.

const TutorialDialogScene := preload("res://scenes/tutorial/tutorial_dialog.gd")

# ── Step state machine ────────────────────────────────────────────────
enum Step {
	INTRO,               # 0
	GEAR_REWARD,         # 1
	EQUIP_GEAR,          # 2
	SKILL_EXPLAIN,       # 3
	FOLLOWER_REWARD,     # 4
	FOLLOWER_RISK,       # 5 — warn about follower economics
	DUNGEON_INTRO,       # 6 — explain, then launch real dungeon_battle
	DUNGEON_RESULT,      # 7 — returning from dungeon_battle
	LADDER_INTRO,        # 8 — explain, then launch real battle
	LADDER_RESULT,       # 9 — returning from battle
	COMPLETE,            # 10
}

# ── Refs ──────────────────────────────────────────────────────────────
var _gs: Node
var _idb: Node
var _fdb: Node
var _sdb: Node
var _persistence: Node

# ── State ─────────────────────────────────────────────────────────────
var _step: int = Step.INTRO
var _dialog  # TutorialDialog instance
var _content: Control
var _sprite_layer: Node2D  # Node2D layer for sprites (renders correctly over Control)
var _skip_layer: CanvasLayer
var _skip_btn: Button

# Reward tracking
var _reward_weapon: Dictionary = {}
var _reward_follower_name: String = ""

const CLASS_WEAPONS: Dictionary = {
	"wizard": "crystal_staff",
	"ranger": "shortbow",
	"assassin": "hunting_knives",
	"barbarian": "iron_sword",
}

const CLASS_FOLLOWERS: Dictionary = {
	"wizard": "Ember Sprite",
	"ranger": "Fire Imp",
	"assassin": "Shadow Rat",
	"barbarian": "Stone Golem",
}

const CLASS_NAMES: Dictionary = {
	"wizard": "Wizard", "ranger": "Ranger",
	"assassin": "Assassin", "barbarian": "Barbarian",
}

const CLASS_HEX: Dictionary = {
	"wizard": "#44ddbb", "ranger": "#ffaa44",
	"assassin": "#66ccff", "barbarian": "#cc4444",
}


func _ready() -> void:
	_gs = get_node("/root/GameState")
	_idb = get_node("/root/ItemDatabase")
	_fdb = get_node("/root/FollowerDatabase")
	_sdb = get_node("/root/SkillDatabase")
	_persistence = get_node("/root/Persistence")

	if _gs.tutorial_completed:
		TransitionManager.fade_to_scene("res://scenes/character_forge/character_forge.tscn")
		return

	var sfx := get_node_or_null("/root/SfxManager")
	if sfx:
		sfx.play_context("tutorial")

	_setup_background()

	_content = Control.new()
	_content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_content)

	# Node2D layer for sprites — sits on top of Control content
	_sprite_layer = Node2D.new()
	add_child(_sprite_layer)

	_build_skip_button()

	# Restore step if returning from a real battle/dungeon scene
	_step = _gs._tutorial_step
	_enter_step()


# ── Step Machine ──────────────────────────────────────────────────────

func _advance() -> void:
	_step += 1
	_gs._tutorial_step = _step
	_enter_step()


func _enter_step() -> void:
	match _step:
		Step.INTRO: _show_intro()
		Step.GEAR_REWARD: _show_gear_reward()
		Step.EQUIP_GEAR: _show_equip_gear()
		Step.SKILL_EXPLAIN: _show_skill_explain()
		Step.FOLLOWER_REWARD: _show_follower_reward()
		Step.FOLLOWER_RISK: _show_follower_risk()
		Step.DUNGEON_INTRO: _show_dungeon_intro()
		Step.DUNGEON_RESULT: _show_dungeon_result()
		Step.LADDER_INTRO: _show_ladder_intro()
		Step.LADDER_RESULT: _show_ladder_result()
		Step.COMPLETE: _show_complete()


# ══════════════════════════════════════════════════════════════════════
# INTRO (Step 0)
# ══════════════════════════════════════════════════════════════════════

func _show_intro() -> void:
	_clear_content()
	var class_key: String = _gs.custom_char.get("class_key", "barbarian")

	# Hero sprite centered on screen
	var hero_sprite := LayeredSprite.new()
	hero_sprite.set_class(class_key)
	hero_sprite.scale = Vector2(2.0, 2.0)
	hero_sprite.position = Vector2(480, 170)
	hero_sprite.start_idle_bob(0.5, 2.0)
	_sprite_layer.add_child(hero_sprite)

	var player_name: String = _gs.custom_char.get("name", "Hero")
	var class_hex: String = CLASS_HEX.get(class_key, "#cccccc")
	var class_name_str: String = CLASS_NAMES.get(class_key, "Hero")

	_show_dialog(
		"Oh good, another one. [color=#ffda66]" + player_name + "[/color], " +
		"a [color=" + class_hex + "]" + class_name_str + "[/color]. " +
		"I am [color=#ff7722]Dio[/color]. I'll be the voice in your head until " +
		"you inevitably die. Let's make this interesting."
	)


# ══════════════════════════════════════════════════════════════════════
# GEAR REWARD (Step 1)
# ══════════════════════════════════════════════════════════════════════

func _show_gear_reward() -> void:
	_clear_content()
	var class_key: String = _gs.custom_char.get("class_key", "barbarian")
	var weapon_key: String = CLASS_WEAPONS.get(class_key, "iron_sword")
	_reward_weapon = _idb.roll_gear_instance(weapon_key)
	if _reward_weapon.is_empty():
		_advance()
		return

	_gs.gear_bag.append(_reward_weapon)
	SteamManager.check_gear(_reward_weapon)

	# Gear icon — centered above panel
	var icon_tex: Texture2D = IconMap.get_item_icon(_reward_weapon.get("base_key", ""))
	if icon_tex:
		var icon_rect := TextureRect.new()
		icon_rect.texture = icon_tex
		icon_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		icon_rect.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
		icon_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon_rect.custom_minimum_size = Vector2(40, 40)
		icon_rect.position = Vector2(460, 12)
		_content.add_child(icon_rect)

	var rarity: String = _reward_weapon.get("rarity", "common")
	var panel := PanelContainer.new()
	var pstyle := ThemeManager.make_panel_style()
	pstyle.border_color = ThemeManager.get_rarity_color(rarity)
	pstyle.set_border_width_all(2)
	panel.add_theme_stylebox_override("panel", pstyle)
	panel.position = Vector2(340, 55)
	panel.custom_minimum_size = Vector2(280, 120)
	_content.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 3)
	panel.add_child(vbox)

	var name_lbl := Label.new()
	name_lbl.text = _reward_weapon.get("name", weapon_key)
	name_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["heading"])
	name_lbl.add_theme_color_override("font_color", ThemeManager.get_rarity_color(rarity))
	name_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(name_lbl)

	var rarity_lbl := Label.new()
	rarity_lbl.text = rarity.capitalize() + " Weapon"
	rarity_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
	rarity_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	rarity_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(rarity_lbl)

	var stats: Dictionary = _reward_weapon.get("stats", {})
	var stat_text := ""
	for key in stats:
		var val = stats[key]
		stat_text += _stat_display_name(key) + ": " + (str(snapped(val, 0.01)) if val is float else str(val)) + "  "
	var stats_lbl := Label.new()
	stats_lbl.text = stat_text.strip_edges()
	stats_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	stats_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stats_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD
	vbox.add_child(stats_lbl)

	var header := Label.new()
	header.text = "NEW WEAPON FOUND!"
	header.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])
	header.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	header.position = Vector2(360, 28)
	header.custom_minimum_size = Vector2(240, 0)
	_content.add_child(header)

	_show_dialog(
		"I found this lying around. Well, I [i]took[/i] it from the last champion. " +
		"They won't be needing it anymore. You're welcome."
	)


# ══════════════════════════════════════════════════════════════════════
# EQUIP GEAR (Step 2)
# ══════════════════════════════════════════════════════════════════════

func _show_equip_gear() -> void:
	_clear_content()
	var current_weapon: Dictionary = _gs.equipment.get("weapon", {})
	var old_name: String = current_weapon.get("name", "Starter Weapon")
	var old_stats: Dictionary = current_weapon.get("stats", {})
	var old_base_key: String = current_weapon.get("base_key", "rusty_blade")
	var new_name: String = _reward_weapon.get("name", "New Weapon")
	var new_stats: Dictionary = _reward_weapon.get("stats", {})
	var new_rarity: String = _reward_weapon.get("rarity", "common")
	var new_base_key: String = _reward_weapon.get("base_key", "")

	# Centered wrapper for the whole comparison UI
	var wrapper := VBoxContainer.new()
	wrapper.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	wrapper.offset_top = 30
	wrapper.add_theme_constant_override("separation", 12)
	_content.add_child(wrapper)

	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 16)
	hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	wrapper.add_child(hbox)

	hbox.add_child(_make_weapon_panel(old_name, old_stats, "starter", "Current", old_base_key))
	var arrow := Label.new()
	arrow.text = ">>"
	arrow.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])
	arrow.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	arrow.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	hbox.add_child(arrow)
	hbox.add_child(_make_weapon_panel(new_name, new_stats, new_rarity, "New!", new_base_key))

	var equip_btn := Button.new()
	equip_btn.text = "Equip New Weapon"
	equip_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_stone_button(equip_btn, ThemeManager.COLOR_SUCCESS_GREEN)
	equip_btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	equip_btn.pressed.connect(_do_equip_weapon)
	wrapper.add_child(equip_btn)

	_show_dialog(
		"[color=#44ff88]Green numbers[/color] mean better. I know, shocking. " +
		"Equip it or don't — but if you die because of your garbage weapon, " +
		"that's a [i]you[/i] problem."
	)


func _make_weapon_panel(weapon_name: String, stats: Dictionary, rarity: String, label_text: String, base_key: String = "") -> PanelContainer:
	var panel := PanelContainer.new()
	var style := ThemeManager.make_panel_style(1.0)
	style.border_color = ThemeManager.get_rarity_color(rarity)
	style.set_border_width_all(2)
	style.set_content_margin_all(8)
	panel.add_theme_stylebox_override("panel", style)
	panel.custom_minimum_size = Vector2(180, 140)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 3)
	panel.add_child(vbox)
	var tag := Label.new()
	tag.text = label_text
	tag.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
	tag.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	tag.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(tag)
	# Weapon icon
	var icon_tex: Texture2D = IconMap.get_item_icon(base_key) if not base_key.is_empty() else null
	if icon_tex:
		var icon := TextureRect.new()
		icon.texture = icon_tex
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.custom_minimum_size = Vector2(32, 32)
		icon.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		vbox.add_child(icon)
	var name_lbl := Label.new()
	name_lbl.text = weapon_name
	name_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	name_lbl.add_theme_color_override("font_color", ThemeManager.get_rarity_color(rarity))
	name_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(name_lbl)
	for key in stats:
		var lbl := Label.new()
		var val = stats[key]
		lbl.text = _stat_display_name(key) + ": " + (str(snapped(val, 0.01)) if val is float else str(val))
		lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
		lbl.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
		vbox.add_child(lbl)
	return panel


func _do_equip_weapon() -> void:
	var old_weapon: Dictionary = _gs.equipment.get("weapon", {})
	if not old_weapon.is_empty():
		_gs.gear_bag.append(old_weapon)
	var bag_idx: int = _gs.gear_bag.find(_reward_weapon)
	if bag_idx >= 0:
		_gs.gear_bag.remove_at(bag_idx)
	_gs.equipment["weapon"] = _reward_weapon
	_persistence.save_game()
	_advance()


# ══════════════════════════════════════════════════════════════════════
# SKILL EXPLAIN (Step 3)
# ══════════════════════════════════════════════════════════════════════

func _show_skill_explain() -> void:
	_clear_content()
	var skills_arr: Array = _gs.custom_char.get("skills", [])
	var ult_idx = _gs.custom_char.get("ultimate", -1)
	var all_skills: Array[Dictionary] = _sdb.get_all_skills()
	var all_ults: Array[Dictionary] = _sdb.get_all_ultimates()

	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", ThemeManager.make_panel_style())
	panel.position = Vector2(240, 40)
	panel.custom_minimum_size = Vector2(480, 160)
	_content.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 4)
	panel.add_child(vbox)

	var title := Label.new()
	title.text = "YOUR ABILITIES"
	title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["heading"])
	title.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(title)

	for i in range(mini(2, skills_arr.size())):
		var sk_idx: int = int(skills_arr[i])
		if sk_idx >= 0 and sk_idx < all_skills.size():
			vbox.add_child(_make_skill_row(all_skills[sk_idx], false))

	if ult_idx != null and int(ult_idx) >= 0 and int(ult_idx) < all_ults.size():
		vbox.add_child(_make_skill_row(all_ults[int(ult_idx)], true))

	_show_dialog(
		"Your abilities run on [color=#44aaff]Power[/color]. You get 200 of it, " +
		"it regenerates, and you'll waste most of it. Mix skills from any class " +
		"— fire, shadow, arrows — all cost Power. Warrior skills are free " +
		"because swinging sharp metal doesn't require intellect. " +
		"The [color=#ff8844]ultimate[/color] triggers when you're almost dead — " +
		"think of it as a farewell gift."
	)


func _make_skill_row(skill: Dictionary, is_ult: bool) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	var skill_id: String = skill.get("id", "")
	var icon_tex: Texture2D = IconMap.get_skill_icon(skill_id)
	if icon_tex:
		var icon_rect := TextureRect.new()
		icon_rect.texture = icon_tex
		icon_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		icon_rect.custom_minimum_size = Vector2(20, 20)
		icon_rect.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
		icon_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		row.add_child(icon_rect)
	else:
		var icon_lbl := Label.new()
		icon_lbl.text = skill.get("icon", "?")
		icon_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["icon"])
		row.add_child(icon_lbl)
	var name_lbl := Label.new()
	name_lbl.text = skill.get("name", "Unknown")
	name_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	name_lbl.add_theme_color_override("font_color", Color(1.0, 0.7, 0.2) if is_ult else ThemeManager.COLOR_ACCENT_TEAL)
	name_lbl.custom_minimum_size = Vector2(100, 0)
	row.add_child(name_lbl)
	var desc_lbl := Label.new()
	desc_lbl.text = skill.get("desc", "")
	desc_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
	desc_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	desc_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD
	desc_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(desc_lbl)
	if is_ult:
		var tag := Label.new()
		tag.text = "[ULT]"
		tag.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
		tag.add_theme_color_override("font_color", Color(1.0, 0.5, 0.2))
		row.add_child(tag)
	return row


# ══════════════════════════════════════════════════════════════════════
# FOLLOWER REWARD (Step 4)
# ══════════════════════════════════════════════════════════════════════

func _show_follower_reward() -> void:
	_clear_content()
	var class_key: String = _gs.custom_char.get("class_key", "barbarian")
	_reward_follower_name = CLASS_FOLLOWERS.get(class_key, "Stone Golem")
	var tmpl: Dictionary = _fdb.get_template(_reward_follower_name)
	if tmpl.is_empty():
		_advance()
		return

	# Only grant if not already granted (in case of scene reload)
	var already_has := false
	for f in _gs.followers:
		if f.get("template_name", "") == _reward_follower_name:
			already_has = true
			break
	if not already_has:
		var f_instance := {
			"template_name": tmpl.get("name", ""),
			"name": tmpl.get("name", ""),
			"icon": tmpl.get("icon", ""),
			"rarity": tmpl.get("rarity", "common"),
			"buff": tmpl.get("buff", {}).duplicate(true),
			"buff_desc": tmpl.get("buff_desc", ""),
			"ability_name": tmpl.get("ability_name", ""),
			"ability_desc": tmpl.get("ability_desc", ""),
			"upgrades": 0,
			"combat_hp": int(tmpl.get("combat_hp", 400)),
			"combat_dmg": int(tmpl.get("combat_dmg", 30)),
			"combat_as": float(tmpl.get("combat_as", 1.0)),
			"combat_def": int(tmpl.get("combat_def", 10)),
			"combat_range": int(tmpl.get("combat_range", 60)),
			"id": str(Time.get_unix_time_from_system()) + "_" + str(randi()),
		}
		_gs.followers.append(f_instance)
		_gs.active_follower = _gs.followers.size() - 1
		SteamManager.check_follower(f_instance, _gs.followers.size())

	var rarity: String = tmpl.get("rarity", "common")

	# Follower sprite — centered above panel
	var safe_name: String = _reward_follower_name.to_lower().replace(" ", "_")
	var f_tex = load("res://assets/sprites/generated/followers/" + safe_name + ".png")
	if f_tex:
		var f_sprite := TextureRect.new()
		f_sprite.texture = f_tex
		f_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		f_sprite.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
		f_sprite.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		f_sprite.custom_minimum_size = Vector2(48, 48)
		f_sprite.position = Vector2(456, 2)
		_content.add_child(f_sprite)

	var panel := PanelContainer.new()
	var pstyle := ThemeManager.make_panel_style()
	pstyle.border_color = ThemeManager.get_rarity_color(rarity)
	pstyle.set_border_width_all(2)
	panel.add_theme_stylebox_override("panel", pstyle)
	panel.position = Vector2(350, 55)
	panel.custom_minimum_size = Vector2(260, 130)
	_content.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 3)
	panel.add_child(vbox)

	var header := Label.new()
	header.text = "NEW FOLLOWER!"
	header.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])
	header.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(header)

	var name_row := HBoxContainer.new()
	name_row.alignment = BoxContainer.ALIGNMENT_CENTER
	name_row.add_theme_constant_override("separation", 6)
	vbox.add_child(name_row)
	var name_lbl := Label.new()
	name_lbl.text = tmpl.get("name", "")
	name_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["heading"])
	name_lbl.add_theme_color_override("font_color", ThemeManager.get_rarity_color(rarity))
	name_row.add_child(name_lbl)

	var buff_lbl := Label.new()
	buff_lbl.text = "Passive: " + tmpl.get("buff_desc", "")
	buff_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	buff_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_SUCCESS_GREEN)
	buff_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(buff_lbl)

	var ability_lbl := Label.new()
	ability_lbl.text = "Ability: " + tmpl.get("ability_name", "") + " - " + tmpl.get("ability_desc", "")
	ability_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
	ability_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_ACCENT_TEAL)
	ability_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ability_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD
	vbox.add_child(ability_lbl)

	_show_dialog(
		"A [color=#ffda66]follower[/color]. It'll fight for you, buff your stats, " +
		"and probably outlive you. Followers are crafted from [color=#4060c0]Dust[/color] — " +
		"which you get by destroying gear you don't need. Circle of life."
	)


# ══════════════════════════════════════════════════════════════════════
# FOLLOWER RISK (Step 5) — warn about follower economics
# ══════════════════════════════════════════════════════════════════════

func _show_follower_risk() -> void:
	_clear_content()
	_show_dialog(
		"One more thing about followers. They're not immortal. " +
		"Die in a dungeon and you'll lose [color=#ff4444]half[/color] the followers " +
		"you captured down there. Stake one in an arena wager and lose? Gone. " +
		"Abandon a dungeon run? You keep what you found, but don't make it " +
		"a habit — I'm keeping score."
	)


# ══════════════════════════════════════════════════════════════════════
# DUNGEON INTRO (Step 6) — explain then launch real dungeon_battle
# ══════════════════════════════════════════════════════════════════════

func _show_dungeon_intro() -> void:
	_clear_content()

	# Show goblin sprite as preview
	var goblin_tex = load("res://assets/sprites/generated/monsters/goblin_scout.png")
	if goblin_tex:
		var goblin_sprite := TextureRect.new()
		goblin_sprite.texture = goblin_tex
		goblin_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		goblin_sprite.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
		goblin_sprite.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		goblin_sprite.custom_minimum_size = Vector2(80, 80)
		goblin_sprite.position = Vector2(440, 60)
		_content.add_child(goblin_sprite)

		var goblin_label := Label.new()
		goblin_label.text = "Goblin Scout"
		goblin_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		goblin_label.add_theme_color_override("font_color", ThemeManager.COLOR_HP_RED)
		goblin_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		goblin_label.position = Vector2(428, 142)
		goblin_label.custom_minimum_size = Vector2(104, 0)
		_content.add_child(goblin_label)

	_show_dialog(
		"Time for your first [color=#44ff88]Dungeon[/color] fight. Unlike the Ladder, " +
		"this is [color=#ffaa44]turn-based[/color] — you choose Attack, Skills, Potions, " +
		"or Flee. Yes, I'm trusting you with buttons. Each clear makes the dungeon " +
		"harder, so try not to embarrass me.",
		["Enter Dungeon Battle"]
	)


func _launch_dungeon_fight() -> void:
	_gs.start_dungeon_run()

	var monster: Dictionary = {
		"name": "Goblin Scout",
		"icon": "G",
		"type": "humanoid",
		"hp": 600,
		"max_hp": 600,
		"dmg": 40,
		"def": 10,
		"as": 0.8,
		"evasion": 0.0,
		"specials": [],
	}
	_gs.dg_run["combat_enemy"] = monster
	_gs.dg_run["combat_turn"] = 0
	_gs.dg_run["last_combat_stats"] = {
		"turns": 0, "dmg_dealt": 0, "dmg_taken": 0,
		"hp_before": int(_gs.dg_run.get("hp", 0)),
		"monster_name": "Goblin Scout", "monster_icon": "G",
	}

	_gs._tutorial_return = true
	_gs._tutorial_step = Step.DUNGEON_RESULT

	TransitionManager.fade_to_scene("res://scenes/dungeon_battle/dungeon_battle.tscn")


# ══════════════════════════════════════════════════════════════════════
# DUNGEON RESULT (Step 7) — returning from dungeon_battle
# ══════════════════════════════════════════════════════════════════════

func _show_dungeon_result() -> void:
	_clear_content()
	_gs.dg_run = {}
	_show_dialog(
		"You survived. Genuinely surprising. Dungeons have multiple floors " +
		"with combat, treasure, traps, and things that want to eat you. " +
		"Now let's see how you handle [color=#ffaa44]real-time[/color] combat."
	)


# ══════════════════════════════════════════════════════════════════════
# LADDER INTRO (Step 8) — explain then launch real battle
# ══════════════════════════════════════════════════════════════════════

func _show_ladder_intro() -> void:
	_clear_content()
	_show_dialog(
		"The [color=#ffaa44]Ladder[/color] is real-time. Your champion fights automatically " +
		"— skills fire on their own because I don't trust you under pressure. " +
		"You just watch, hope, and pretend you contributed.",
		["Enter Ladder Battle"]
	)


func _launch_ladder_fight() -> void:
	_gs.ladder_run = {
		"wins": 0, "active": true, "opponent_idx": 0,
		"history": [], "_previewed_next": {},
		"current_opp_name": "Training Wizard",
		"current_opp_icon": "?",
		"companion": _gs.active_follower,
		"last_player_hp": 0, "last_player_max_hp": 1, "last_opp_hp": 0,
	}
	_gs._ladder_mode = true
	_gs._ladder_opponent = {"class_key": "wizard", "is_generated": false}
	_gs._ladder_result = ""

	_gs._tutorial_return = true
	_gs._tutorial_step = Step.LADDER_RESULT

	TransitionManager.fade_to_scene("res://scenes/battle/battle.tscn")


# ══════════════════════════════════════════════════════════════════════
# LADDER RESULT (Step 9) — returning from battle
# ══════════════════════════════════════════════════════════════════════

func _show_ladder_result() -> void:
	_clear_content()
	_gs.ladder_run = {}
	_gs._ladder_mode = false
	_gs._ladder_opponent = {}
	_gs._ladder_result = ""
	_show_dialog(
		"Still alive? The Ladder gets progressively more unfair the higher you climb. " +
		"I designed it that way. For entertainment."
	)


# ══════════════════════════════════════════════════════════════════════
# COMPLETE (Step 10)
# ══════════════════════════════════════════════════════════════════════

func _show_complete() -> void:
	_clear_content()
	_skip_btn.visible = false

	_gs.gold += 50
	_gs.dust += 20
	_gs.tutorial_completed = true
	_gs._tutorial_step = 0
	_persistence.save_game()
	SteamManager.unlock("TUTORIAL_COMPLETE")
	SteamManager.check_dust(_gs.dust)

	var header := Label.new()
	header.text = "TUTORIAL COMPLETE"
	header.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["main_title"])
	header.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
	header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	header.position = Vector2(210, 25)
	header.custom_minimum_size = Vector2(540, 0)
	_content.add_child(header)

	var class_key: String = _gs.custom_char.get("class_key", "barbarian")
	var hero_sprite := LayeredSprite.new()
	hero_sprite.set_class(class_key)
	hero_sprite.scale = Vector2(1.2, 1.2)
	hero_sprite.position = Vector2(480, 160)
	hero_sprite.start_idle_bob(0.5, 2.0)
	_sprite_layer.add_child(hero_sprite)

	var rewards_panel := PanelContainer.new()
	rewards_panel.add_theme_stylebox_override("panel", ThemeManager.make_inset_style())
	rewards_panel.position = Vector2(320, 300)
	rewards_panel.custom_minimum_size = Vector2(320, 65)
	_content.add_child(rewards_panel)

	# Fade-in animation on rewards
	rewards_panel.modulate.a = 0.0
	var tw := create_tween()
	tw.tween_property(rewards_panel, "modulate:a", 1.0, 0.3).set_delay(0.2)

	var rvbox := VBoxContainer.new()
	rvbox.add_theme_constant_override("separation", 1)
	rewards_panel.add_child(rvbox)
	var r_title := Label.new()
	r_title.text = "Bonus rewards: 50 Gold + 20 Dust"
	r_title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
	r_title.add_theme_color_override("font_color", ThemeManager.COLOR_ACCENT_TEAL)
	r_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	rvbox.add_child(r_title)

	var player_name: String = _gs.custom_char.get("name", "Hero")
	_show_dialog(
		"Against all odds, [color=#ffda66]" + player_name + "[/color], you didn't die. " +
		"Here's some gold and dust. Don't spend it all on... actually, " +
		"spend it however you want. You'll need every advantage. " +
		"Now go. The Forge awaits. I'll be watching.",
		["Enter the Forge"]
	)


# ══════════════════════════════════════════════════════════════════════
# DIALOG HELPER
# ══════════════════════════════════════════════════════════════════════

func _show_dialog(text: String, buttons: Array = ["Continue"]) -> void:
	if _dialog:
		_dialog.close()
		_dialog.queue_free()
		_dialog = null
	_dialog = TutorialDialogScene.new()
	add_child(_dialog)
	_dialog.show_dialog(text, buttons)
	_dialog.option_selected.connect(_on_dialog_option)


func _on_dialog_option(_idx: int) -> void:
	if _dialog:
		_dialog.queue_free()
		_dialog = null
	match _step:
		Step.COMPLETE:
			TransitionManager.fade_to_scene("res://scenes/character_forge/character_forge.tscn")
		Step.EQUIP_GEAR:
			pass  # Wait for equip button
		Step.DUNGEON_INTRO:
			_launch_dungeon_fight()
		Step.LADDER_INTRO:
			_launch_ladder_fight()
		_:
			_advance()


# ══════════════════════════════════════════════════════════════════════
# SKIP BUTTON
# ══════════════════════════════════════════════════════════════════════

func _build_skip_button() -> void:
	_skip_layer = CanvasLayer.new()
	_skip_layer.layer = 60
	add_child(_skip_layer)

	_skip_btn = Button.new()
	_skip_btn.text = "Skip Tutorial"
	_skip_btn.theme = get_tree().root.theme
	_skip_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
	_skip_btn.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	ThemeManager.style_stone_button(_skip_btn, ThemeManager.COLOR_BORDER_DIM)
	_skip_btn.position = Vector2(860, 4)
	_skip_btn.pressed.connect(_on_skip_pressed)
	_skip_layer.add_child(_skip_btn)


func _on_skip_pressed() -> void:
	var overlay := ColorRect.new()
	overlay.color = ThemeManager.COLOR_OVERLAY_DIM
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	overlay.theme = get_tree().root.theme
	_skip_layer.add_child(overlay)

	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", ThemeManager.make_panel_style())
	panel.position = Vector2(330, 200)
	panel.custom_minimum_size = Vector2(300, 100)
	overlay.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)
	panel.add_child(vbox)

	var msg := Label.new()
	msg.text = "Skip Dio's wisdom?"
	msg.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["heading"])
	msg.add_theme_color_override("font_color", Color(1.0, 0.45, 0.1))
	msg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(msg)

	var sub_msg := Label.new()
	sub_msg.text = "You'll still get all the starter loot."
	sub_msg.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	sub_msg.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	sub_msg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(sub_msg)

	var btn_row := HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.add_theme_constant_override("separation", 12)
	vbox.add_child(btn_row)

	var skip_confirm := Button.new()
	skip_confirm.text = "Skip"
	ThemeManager.style_stone_button(skip_confirm, ThemeManager.COLOR_HP_RED)
	skip_confirm.pressed.connect(func():
		overlay.queue_free()
		_execute_skip()
	)
	btn_row.add_child(skip_confirm)

	var cancel := Button.new()
	cancel.text = "Cancel"
	ThemeManager.style_stone_button(cancel)
	cancel.pressed.connect(func(): overlay.queue_free())
	btn_row.add_child(cancel)


func _execute_skip() -> void:
	_grant_all_rewards()
	_gs.tutorial_completed = true
	_gs._tutorial_step = 0
	_persistence.save_game()
	SteamManager.unlock("TUTORIAL_COMPLETE")
	SteamManager.check_dust(_gs.dust)
	TransitionManager.fade_to_scene("res://scenes/character_forge/character_forge.tscn")


func _grant_all_rewards() -> void:
	var class_key: String = _gs.custom_char.get("class_key", "barbarian")

	var current_weapon: Dictionary = _gs.equipment.get("weapon", {})
	var weapon_key: String = CLASS_WEAPONS.get(class_key, "iron_sword")
	if current_weapon.get("base_key", "") != weapon_key:
		var weapon: Dictionary = _idb.roll_gear_instance(weapon_key)
		if not weapon.is_empty():
			var old: Dictionary = _gs.equipment.get("weapon", {})
			if not old.is_empty():
				_gs.gear_bag.append(old)
			_gs.equipment["weapon"] = weapon

	var follower_name: String = CLASS_FOLLOWERS.get(class_key, "Stone Golem")
	var already_has := false
	for f in _gs.followers:
		if f.get("template_name", "") == follower_name:
			already_has = true
			break
	if not already_has:
		var tmpl: Dictionary = _fdb.get_template(follower_name)
		if not tmpl.is_empty():
			var f_instance := {
				"template_name": tmpl.get("name", ""),
				"name": tmpl.get("name", ""),
				"icon": tmpl.get("icon", ""),
				"rarity": tmpl.get("rarity", "common"),
				"buff": tmpl.get("buff", {}).duplicate(true),
				"buff_desc": tmpl.get("buff_desc", ""),
				"ability_name": tmpl.get("ability_name", ""),
				"ability_desc": tmpl.get("ability_desc", ""),
				"upgrades": 0,
				"combat_hp": int(tmpl.get("combat_hp", 400)),
				"combat_dmg": int(tmpl.get("combat_dmg", 30)),
				"combat_as": float(tmpl.get("combat_as", 1.0)),
				"combat_def": int(tmpl.get("combat_def", 10)),
				"combat_range": int(tmpl.get("combat_range", 60)),
				"id": str(Time.get_unix_time_from_system()) + "_" + str(randi()),
			}
			_gs.followers.append(f_instance)
			_gs.active_follower = _gs.followers.size() - 1

	_gs.gold += 50
	_gs.dust += 20


# ══════════════════════════════════════════════════════════════════════
# UTILITIES
# ══════════════════════════════════════════════════════════════════════

func _clear_content() -> void:
	for child in _content.get_children():
		child.queue_free()
	for child in _sprite_layer.get_children():
		child.queue_free()
	if _dialog:
		_dialog.close()
		_dialog.queue_free()
		_dialog = null
	# Fade in new content
	_content.modulate.a = 0.0
	var tw := create_tween()
	tw.tween_property(_content, "modulate:a", 1.0, 0.3)


func _setup_background() -> void:
	var tex = load("res://assets/tilesets/battle_backgrounds/dark_forest.png")
	if tex:
		var bg := TextureRect.new()
		bg.texture = tex
		bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		bg.modulate = Color(0.12, 0.08, 0.14, 1.0)
		var old_bg = $Background
		if old_bg:
			old_bg.queue_free()
		add_child(bg)
		move_child(bg, 0)


func _stat_display_name(key: String) -> String:
	match key:
		"base_dmg": return "DMG"
		"base_as": return "AS"
		"def": return "DEF"
		"hp": return "HP"
		"evasion": return "Eva"
		"move_speed": return "Spd"
		"power": return "Power"
		"spell_dmg_bonus": return "Spell%"
		_: return key.capitalize()
