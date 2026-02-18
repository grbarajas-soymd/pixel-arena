extends Control
## Dungeon battle UI — turn-based combat scene driven by DungeonCombatEngine.

@onready var hero_name_lbl: Label = %HeroName
@onready var hero_hp_bar: ProgressBar = %HeroHpBar
@onready var monster_name_lbl: Label = %MonsterName
@onready var monster_hp_bar: ProgressBar = %MonsterHpBar
@onready var hero_resource: ProgressBar = %HeroResource
@onready var hero_buffs: HBoxContainer = %HeroBuffs
@onready var monster_buffs: HBoxContainer = %MonsterBuffs
@onready var hero_stats_lbl: Label = %HeroStats
@onready var monster_stats_lbl: Label = %MonsterStats
@onready var hero_status_panel: PanelContainer = %HeroStatusPanel
@onready var hero_status_vbox: VBoxContainer = %HeroStatusVBox
@onready var monster_status_panel: PanelContainer = %MonsterStatusPanel
@onready var monster_status_vbox: VBoxContainer = %MonsterStatusVBox
@onready var companion_hp_bar: ProgressBar = %CompanionHp
var hero_sprite: LayeredSprite
var monster_sprite: LayeredSprite
var companion_sprite: LayeredSprite
@onready var float_container: Node2D = %FloatContainer
@onready var telegraph_panel: PanelContainer = %TelegraphPanel
@onready var telegraph_label: Label = %TelegraphLabel
@onready var turn_label: Label = %TurnLabel
@onready var combat_log: RichTextLabel = %CombatLog
@onready var skill_info_lbl: Label = %SkillInfoLabel
@onready var result_overlay: PanelContainer = %ResultOverlay
@onready var result_vbox: VBoxContainer = %ResultVBox

@onready var atk_btn: Button = %AtkBtn
@onready var skill0_btn: Button = %Skill0Btn
@onready var skill1_btn: Button = %Skill1Btn
@onready var ult_btn: Button = %UltBtn
@onready var pot_btn: Button = %PotBtn
@onready var comp_btn: Button = %CompBtn
@onready var flee_btn: Button = %FleeBtn
@onready var auto_btn: Button = %AutoBtn
@onready var log_btn: Button = %LogBtn

var _gs: Node
var _engine: DungeonCombatEngine
var _anim_tween: Tween
var _result: String = ""
var _current_turn: int = 0
var _last_sfx_time: float = 0.0
var _gold_reward: int = 0
var _skill_info: Dictionary = {}
var _skill_info_label: Label
var _turn_info_text: String = ""
var _hovering_skill: bool = false
var _log_visible: bool = false
var _compact_font: Font
var _current_actor: String = ""
var _status_particle_timer: float = 0.0
var _turn_order_slots: Array[PanelContainer] = []
var _turn_order_labels: Array[Label] = []
var _turn_order_container: HBoxContainer

# SFX preloads
var _sfx_hit: AudioStream = preload("res://assets/audio/sfx/woosh-1.wav")
var _sfx_crit: AudioStream = preload("res://assets/audio/sfx/woosh-2.wav")
var _sfx_victory_pool: Array[AudioStream] = [
	preload("res://assets/audio/sfx/victory-1.wav"),
	preload("res://assets/audio/sfx/victory-2.wav"),
	preload("res://assets/audio/sfx/victory-3.wav"),
]
var _sfx_defeat_pool: Array[AudioStream] = [
	preload("res://assets/audio/sfx/monster-1.wav"),
	preload("res://assets/audio/sfx/monster-2.wav"),
]
var _sfx_heal: AudioStream = preload("res://assets/audio/sfx/2.ogg")
var _sfx_skill: AudioStream = preload("res://assets/audio/sfx/4.ogg")

# Sprite positions (base)
const HERO_BASE_X: float = 140.0
const MONSTER_BASE_X: float = 500.0
const SPRITE_Y: float = 100.0

# Animation durations (seconds)
const ANIM_ATTACK: float = 0.25
const ANIM_SKILL: float = 0.35

# Flavor quotes from Dio's contemporaries
const COMBAT_WIN_QUOTES: Array[String] = [
	"\"Steel sings, blood flows. The usual.\" — Kael, Blade Mendicant",
	"\"Another notch on the blade. The blade is mostly notches now.\" — Vex, War Oracle",
	"\"Efficient. Brutal. Adequate.\" — Mira, Guild Registrar",
	"\"The monster had a name once. Nobody will remember it.\" — Nyx, Void Shepherd",
	"\"Press on. The dungeon grows restless.\" — Orin, Doomsayer General",
	"\"Not dead yet? The prophecy holds... for now.\" — Sable, Twilight Sage",
]
const COMBAT_LOSS_QUOTES: Array[String] = [
	"\"Every champion's story ends the same. Yours just ended sooner.\" — Nyx, Void Shepherd",
	"\"The dungeon always wins eventually. It has patience you do not.\" — Orin, Doomsayer General",
	"\"At least you died doing what you loved: being underequipped.\" — Kael, Blade Mendicant",
	"\"The abyss sends its regards. And a bill for cleaning fees.\" — Ashara, Bone Whisperer",
	"\"Death is nature's way of telling you to bring more potions.\" — Sable, Twilight Sage",
	"\"I've written your epitaph. It's short.\" — Theron, Lorekeeper",
]
const ANIM_ULT: float = 0.50
const ANIM_POTION: float = 0.20
const ANIM_FLEE: float = 0.30
const ANIM_AUTO_MULT: float = 0.6  # Faster in auto mode

# Skill VFX: skill_idx → {tex, target ("hero"/"monster"), tint (Color), offset_y}
const SKILL_VFX: Dictionary = {
	0: {"tex": "res://assets/sprites/generated/vfx/vfx_arcane_bolt.png", "target": "monster", "tint": Color(1.0, 1.0, 0.4, 0.3), "offset_y": 0},
	1: {"tex": "res://assets/sprites/generated/vfx/vfx_arcane_bolt.png", "target": "monster", "tint": Color.TRANSPARENT, "offset_y": 0},
	2: {"tex": "res://assets/sprites/generated/vfx/vfx_shield.png", "target": "hero", "tint": Color(0.3, 0.9, 0.9, 0.25), "offset_y": 0},
	3: {"tex": "res://assets/sprites/generated/vfx/vfx_magic_sparks.png", "target": "monster", "tint": Color.TRANSPARENT, "offset_y": 0},
	4: {"tex": "res://assets/sprites/generated/vfx/vfx_firebomb.png", "target": "hero", "tint": Color(1.0, 0.5, 0.2, 0.2), "offset_y": 0},
	5: {"tex": "res://assets/sprites/generated/vfx/vfx_magic_sparks.png", "target": "hero", "tint": Color.TRANSPARENT, "offset_y": 0},
	6: {"tex": "res://assets/sprites/generated/vfx/vfx_darkness_orb.png", "target": "hero", "tint": Color(0.1, 0.1, 0.2, 0.3), "offset_y": 0},
	7: {"tex": "res://assets/sprites/generated/vfx/vfx_plant_missile.png", "target": "monster", "tint": Color(0.3, 0.8, 0.3, 0.25), "offset_y": 0},
	8: {"tex": "res://assets/sprites/generated/vfx/vfx_darkness_orb.png", "target": "hero", "tint": Color(0.1, 0.1, 0.2, 0.25), "offset_y": 0},
	9: {"tex": "res://assets/sprites/generated/vfx/vfx_rock_sling.png", "target": "monster", "tint": Color.TRANSPARENT, "offset_y": 0},
	10: {"tex": "res://assets/sprites/generated/vfx/vfx_magic_sparks.png", "target": "monster", "tint": Color(1.0, 0.6, 0.2, 0.2), "offset_y": 0},
	11: {"tex": "res://assets/sprites/generated/vfx/vfx_ice_lance.png", "target": "monster", "tint": Color(0.3, 0.6, 1.0, 0.25), "offset_y": 20},
	12: {"tex": "res://assets/sprites/generated/vfx/vfx_darkness_bolt.png", "target": "monster", "tint": Color.TRANSPARENT, "offset_y": 0},
	13: {"tex": "res://assets/sprites/generated/vfx/vfx_firebomb.png", "target": "monster", "tint": Color(1.0, 0.3, 0.2, 0.25), "offset_y": 0},
	14: {"tex": "res://assets/sprites/generated/vfx/vfx_darkness_orb.png", "target": "monster", "tint": Color(0.5, 0.2, 1.0, 0.25), "offset_y": 0},
	15: {"tex": "res://assets/sprites/generated/vfx/vfx_rock_sling.png", "target": "monster", "tint": Color(1.0, 0.3, 0.2, 0.2), "offset_y": 0},
	16: {"tex": "res://assets/sprites/generated/vfx/vfx_shield.png", "target": "hero", "tint": Color(1.0, 0.85, 0.3, 0.2), "offset_y": 0},
	17: {"tex": "res://assets/sprites/generated/vfx/vfx_firebomb.png", "target": "hero", "tint": Color(1.0, 0.3, 0.2, 0.2), "offset_y": 0},
	18: {"tex": "res://assets/sprites/generated/vfx/vfx_plant_missile.png", "target": "hero", "tint": Color(0.3, 0.7, 0.3, 0.2), "offset_y": 0},
}

# Ultimate VFX: ult_idx → {tex, target, flash (Color), shake (float), multi (int)}
const ULT_VFX: Dictionary = {
	0: {"tex": "res://assets/sprites/generated/vfx/vfx_arcane_bolt.png", "target": "monster", "flash": Color(1.0, 1.0, 0.3, 0.35), "shake": 4.0, "multi": 4},
	1: {"tex": "res://assets/sprites/generated/vfx/vfx_firebomb.png", "target": "monster", "flash": Color(1.0, 0.5, 0.15, 0.35), "shake": 3.0, "multi": 1},
	2: {"tex": "res://assets/sprites/generated/vfx/vfx_darkness_orb.png", "target": "monster", "flash": Color(0.5, 0.2, 1.0, 0.3), "shake": 0.0, "multi": 1},
	3: {"tex": "res://assets/sprites/generated/vfx/vfx_firebomb.png", "target": "hero", "flash": Color(1.0, 0.2, 0.1, 0.3), "shake": 3.0, "multi": 1},
	4: {"tex": "res://assets/sprites/generated/vfx/vfx_magic_orb.png", "target": "monster", "flash": Color(0.3, 0.5, 1.0, 0.3), "shake": 3.0, "multi": 1},
	5: {"tex": "res://assets/sprites/generated/vfx/vfx_plant_missile.png", "target": "hero", "flash": Color(0.3, 0.8, 0.3, 0.3), "shake": 0.0, "multi": 1},
	6: {"tex": "res://assets/sprites/generated/vfx/vfx_darkness_bolt.png", "target": "hero", "flash": Color(0.5, 0.2, 1.0, 0.25), "shake": 0.0, "multi": 1},
	7: {"tex": "res://assets/sprites/generated/vfx/vfx_holy_bolt.png", "target": "hero", "flash": Color(1.0, 0.9, 0.4, 0.3), "shake": 0.0, "multi": 1},
}

# Status particle configs: status_id → {color, offset_y, dir_y, spread_x}
const STATUS_PARTICLES: Dictionary = {
	"burn": {"color": Color(1.0, 0.6, 0.15), "offset_y": -20, "dir_y": -15, "spread_x": 8},
	"poison": {"color": Color(0.4, 0.75, 0.25), "offset_y": 0, "dir_y": 12, "spread_x": 6},
	"bleed": {"color": Color(0.8, 0.15, 0.15), "offset_y": 5, "dir_y": 10, "spread_x": 5},
	"slowed": {"color": Color(0.3, 0.7, 1.0), "offset_y": 20, "dir_y": -5, "spread_x": 10},
	"stunned": {"color": Color(1.0, 0.85, 0.2), "offset_y": -30, "dir_y": -3, "spread_x": 12},
	"shield": {"color": Color(0.3, 0.85, 0.85), "offset_y": 10, "dir_y": 3, "spread_x": 14},
	"death_mark": {"color": Color(0.55, 0.25, 1.0), "offset_y": 0, "dir_y": -8, "spread_x": 12},
	"poisoned": {"color": Color(0.4, 0.75, 0.25), "offset_y": 0, "dir_y": 12, "spread_x": 6},
	"enraged": {"color": Color(1.0, 0.3, 0.1), "offset_y": -15, "dir_y": -10, "spread_x": 8},
	"vulnerable": {"color": Color(1.0, 0.4, 0.2), "offset_y": 0, "dir_y": 5, "spread_x": 8},
	"marked": {"color": Color(1.0, 0.65, 0.15), "offset_y": -25, "dir_y": -5, "spread_x": 10},
}


func _ready() -> void:
	_gs = get_node("/root/GameState")

	# Load compact font from ThemeManager
	var tm := get_node_or_null("/root/ThemeManager")
	if tm:
		_compact_font = tm.pixel_font

	# Setup background
	_setup_background()

	# Style + connect action buttons — explicit font override for pixel-crisp rendering
	for btn in [atk_btn, skill0_btn, skill1_btn, ult_btn, pot_btn, comp_btn, flee_btn, auto_btn, log_btn]:
		ThemeManager.style_button(btn)
		if _compact_font:
			btn.add_theme_font_override("font", _compact_font)
		btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	flee_btn.text = "Flee"
	auto_btn.text = "Auto"
	log_btn.text = "Log"
	atk_btn.pressed.connect(func(): _submit("attack"))
	skill0_btn.pressed.connect(func(): _submit("skill0"))
	skill1_btn.pressed.connect(func(): _submit("skill1"))
	ult_btn.pressed.connect(func(): _submit("ultimate"))
	pot_btn.pressed.connect(func(): _submit("potion"))
	flee_btn.pressed.connect(func(): _submit("flee"))
	auto_btn.pressed.connect(func(): _submit("_auto"))
	log_btn.pressed.connect(_toggle_combat_log)
	comp_btn.disabled = true

	# Init combat engine
	_engine = DungeonCombatEngine.new()
	_connect_signals()

	# Build hero/monster data from game state
	var r: Dictionary = _gs.dg_run
	var monster_data: Dictionary = r.get("combat_enemy", {})

	# Get companion data
	var companion_data: Dictionary = {}
	var deployed: Dictionary = r.get("deployed_follower", {})
	if not deployed.is_empty():
		companion_data = deployed

	# Load hero skills/ult from custom_char
	r["skills"] = _gs.custom_char.get("skills", [0, 1])
	r["ultimate"] = int(_gs.custom_char.get("ultimate", 0))
	r["spell_dmg_bonus"] = float(_gs.get_total_stats().get("spell_dmg_bonus", 0.0))

	_engine.init_combat(r, monster_data, companion_data)

	# Setup sprites — create LayeredSprite instances
	_setup_sprites()

	# Style the HUD
	_style_hud()

	# Setup HUD names (clean, no HP numbers — those go on bars)
	hero_name_lbl.text = str(r.get("hero_name", "Hero"))
	hero_name_lbl.clip_text = true
	var mname_full: String = str(monster_data.get("name", "Monster"))
	monster_name_lbl.text = mname_full
	monster_name_lbl.clip_text = true

	# HP number overlays on bars (using compact font for readability)
	for bar in [hero_hp_bar, monster_hp_bar]:
		var hp_lbl := Label.new()
		hp_lbl.name = "HpText"
		if _compact_font:
			hp_lbl.add_theme_font_override("font", _compact_font)
		hp_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		hp_lbl.add_theme_color_override("font_color", Color.WHITE)
		hp_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		hp_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		hp_lbl.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		hp_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		bar.add_child(hp_lbl)

	# Resource bar number overlay
	var res_lbl := Label.new()
	res_lbl.name = "ResText"
	if _compact_font:
		res_lbl.add_theme_font_override("font", _compact_font)
	res_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	res_lbl.add_theme_color_override("font_color", Color.WHITE)
	res_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	res_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	res_lbl.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	res_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hero_resource.add_child(res_lbl)

	# Companion HP overlay
	var comp_lbl := Label.new()
	comp_lbl.name = "CompText"
	if _compact_font:
		comp_lbl.add_theme_font_override("font", _compact_font)
	comp_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	comp_lbl.add_theme_color_override("font_color", Color.WHITE)
	comp_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	comp_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	comp_lbl.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	comp_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	companion_hp_bar.add_child(comp_lbl)

	if _engine.has_companion:
		companion_hp_bar.visible = true
		comp_btn.text = _engine.comp_name.substr(0, 10) if _engine.comp_name.length() > 10 else _engine.comp_name
	else:
		comp_btn.text = "---"

	# Stat panels hidden (data shown in compact stat row instead)
	hero_status_panel.visible = false
	monster_status_panel.visible = false
	_update_stat_row()

	# Initial HUD update
	_update_hud()
	_update_buttons()
	_update_skill_labels()
	_build_turn_order_strip()
	_setup_action_icons()

	combat_log.clear()
	combat_log.visible = false
	_log_visible = false
	turn_label.text = "Battle Start!"
	_turn_info_text = "Battle Start!"
	_update_info_line()


func _process(delta: float) -> void:
	if _engine.phase == "done":
		return
	_status_particle_timer += delta
	if _status_particle_timer < 0.4:
		return
	_status_particle_timer = 0.0
	# Hero status particles
	var hero_statuses: Array = _engine._get_hero_statuses()
	for s in hero_statuses:
		var sid: String = str(s.get("id", ""))
		if STATUS_PARTICLES.has(sid) and hero_sprite:
			_spawn_status_particle(hero_sprite.position, STATUS_PARTICLES[sid])
	# Monster status particles
	var monster_statuses: Array = _engine._get_monster_statuses()
	for s in monster_statuses:
		var sid: String = str(s.get("id", ""))
		if STATUS_PARTICLES.has(sid) and monster_sprite:
			_spawn_status_particle(monster_sprite.position, STATUS_PARTICLES[sid])


func _setup_background() -> void:
	var bg_tex = load("res://assets/tilesets/battle_backgrounds/dungeon_depths.png")
	if bg_tex:
		var bg := TextureRect.new()
		bg.texture = bg_tex
		bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		bg.modulate = Color(0.15, 0.15, 0.30, 1.0)
		var old_bg := $Background
		if old_bg:
			old_bg.queue_free()
		add_child(bg)
		move_child(bg, 0)


func _setup_sprites() -> void:
	var battle_area: Node2D = %FloatContainer.get_parent()

	# Create hero LayeredSprite
	hero_sprite = LayeredSprite.new()
	hero_sprite.position = Vector2(HERO_BASE_X, SPRITE_Y)
	battle_area.add_child(hero_sprite)
	battle_area.move_child(hero_sprite, 0)

	var class_key: String = _engine.hero.get("class_key", "barbarian")
	hero_sprite.set_class(class_key)
	hero_sprite.start_idle_bob(1.0, 1.5)

	# Create monster LayeredSprite
	monster_sprite = LayeredSprite.new()
	monster_sprite.position = Vector2(MONSTER_BASE_X, SPRITE_Y)
	battle_area.add_child(monster_sprite)
	battle_area.move_child(monster_sprite, 1)

	var monster_name: String = str(_engine.monster.get("name", ""))
	monster_sprite.set_monster(monster_name)
	monster_sprite.set_flipped(true)
	monster_sprite.start_idle_bob(1.0, 2.0)

	# Create companion sprite if deployed
	if _engine.has_companion:
		companion_sprite = LayeredSprite.new()
		var comp_name: String = _engine.comp_name
		var height_type: String = HeroFactory.FOLLOWER_HEIGHT.get(comp_name, "ground")
		var height_y: float = HeroFactory.HEIGHT_OFFSETS.get(height_type, 8.0)
		companion_sprite.position = Vector2(HERO_BASE_X - 60, SPRITE_Y + height_y)
		battle_area.add_child(companion_sprite)
		companion_sprite.set_follower(comp_name)
		# Bob animation based on height type
		if height_type == "fly":
			companion_sprite.start_idle_bob(2.0, 1.2 + randf() * 0.3)
		elif height_type == "float":
			companion_sprite.start_idle_bob(1.2, 1.8 + randf() * 0.4)
		else:
			companion_sprite.start_idle_bob(0.3, 2.5)


func _connect_signals() -> void:
	_engine.phase_changed.connect(_on_phase_changed)
	_engine.turn_started.connect(_on_turn_started)
	_engine.action_resolved.connect(_on_action_resolved)
	_engine.damage_dealt.connect(_on_damage_dealt)
	_engine.status_changed.connect(_on_status_changed)
	_engine.combat_ended.connect(_on_combat_ended)
	_engine.telegraph_shown.connect(_on_telegraph_shown)
	_engine.telegraph_cleared.connect(_on_telegraph_cleared)
	_engine.log_added.connect(_on_log_added)
	_engine.hp_changed.connect(_on_hp_changed)
	_engine.companion_died.connect(_on_companion_died)


func _build_stat_panels() -> void:
	# Clear old contents
	for c in hero_status_vbox.get_children():
		c.queue_free()
	for c in monster_status_vbox.get_children():
		c.queue_free()

	# Always visible
	hero_status_panel.visible = true
	monster_status_panel.visible = true

	var h := _engine.hero
	var m := _engine.monster
	var class_key: String = str(h.get("class_key", "barbarian"))
	var class_color: Color = ThemeManager.get_class_color(class_key)

	# Hero panel
	var h_name := Label.new()
	h_name.text = str(h.get("name", "Hero"))
	h_name.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	h_name.add_theme_color_override("font_color", class_color)
	h_name.clip_text = true
	hero_status_vbox.add_child(h_name)

	var h_class := Label.new()
	h_class.text = class_key.capitalize()
	h_class.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	h_class.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	hero_status_vbox.add_child(h_class)

	var h_dmg := int(h.get("base_dmg", 0))
	var h_as := snappedf(float(h.get("base_as", 1.0)), 0.01)
	var h_row1 := Label.new()
	h_row1.text = "DMG:" + str(h_dmg) + " AS:" + str(h_as)
	h_row1.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	h_row1.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
	hero_status_vbox.add_child(h_row1)

	var h_def := int(h.get("def", 0))
	var h_eva := roundi(float(h.get("evasion", 0.0)) * 100.0)
	var h_row2 := Label.new()
	h_row2.text = "DEF:" + str(h_def) + " EVA:" + str(h_eva) + "%"
	h_row2.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	h_row2.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
	hero_status_vbox.add_child(h_row2)

	# Crit + lifesteal row (only if nonzero)
	var h_crit := roundi(float(h.get("crit", 0.0)) * 100.0)
	var h_ls := roundi(float(h.get("lifesteal", 0.0)) * 100.0)
	if h_crit > 0 or h_ls > 0:
		var h_row3 := Label.new()
		var parts: Array[String] = []
		if h_crit > 0:
			parts.append("CRT:" + str(h_crit) + "%")
		if h_ls > 0:
			parts.append("LS:" + str(h_ls) + "%")
		h_row3.text = " ".join(parts)
		h_row3.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		h_row3.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
		hero_status_vbox.add_child(h_row3)

	# Monster panel
	var m_name := Label.new()
	m_name.text = str(m.get("name", "Monster"))
	m_name.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	m_name.add_theme_color_override("font_color", ThemeManager.COLOR_HP_RED)
	m_name.clip_text = true
	monster_status_vbox.add_child(m_name)

	var m_tier: int = int(m.get("tier", 0))
	if m_tier > 0:
		var m_tier_lbl := Label.new()
		m_tier_lbl.text = "Tier " + str(m_tier)
		m_tier_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		m_tier_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
		monster_status_vbox.add_child(m_tier_lbl)

	var m_dmg := int(m.get("base_dmg", 0))
	var m_def := int(m.get("def", 0))
	var m_row1 := Label.new()
	m_row1.text = "DMG:" + str(m_dmg) + " DEF:" + str(m_def)
	m_row1.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	m_row1.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
	monster_status_vbox.add_child(m_row1)

	var m_eva := roundi(float(m.get("evasion", 0.0)) * 100.0)
	if m_eva > 0:
		var m_row2 := Label.new()
		m_row2.text = "EVA:" + str(m_eva) + "%"
		m_row2.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		m_row2.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
		monster_status_vbox.add_child(m_row2)


func _update_stat_row() -> void:
	var h := _engine.hero
	var m := _engine.monster
	var class_key: String = str(h.get("class_key", "barbarian"))
	var class_color: Color = ThemeManager.get_class_color(class_key)

	var h_dmg := int(h.get("base_dmg", 0))
	var h_def := int(h.get("def", 0))
	var h_eva := roundi(float(h.get("evasion", 0.0)) * 100.0)
	var h_crit := roundi(float(h.get("crit", 0.0)) * 100.0)
	var h_spd := _engine.get_effective_speed_for("hero")
	var h_base_spd := _engine.get_base_speed_for("hero")
	var h_spd_text := "SPD:" + str(h_spd)
	if h_spd != h_base_spd:
		h_spd_text += "(" + str(h_base_spd) + ")"
	var h_text := "DMG:" + str(h_dmg) + " DEF:" + str(h_def) + " " + h_spd_text + " EVA:" + str(h_eva) + "%"
	if h_crit > 0:
		h_text += " CRT:" + str(h_crit) + "%"
	hero_stats_lbl.text = h_text
	if _compact_font:
		hero_stats_lbl.add_theme_font_override("font", _compact_font)
	hero_stats_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	hero_stats_lbl.add_theme_color_override("font_color", class_color)

	var m_dmg := int(m.get("base_dmg", 0))
	var m_def := int(m.get("def", 0))
	var m_eva := roundi(float(m.get("evasion", 0.0)) * 100.0)
	var m_tier: int = int(m.get("tier", 0))
	var m_spd := _engine.get_effective_speed_for("monster")
	var m_base_spd := _engine.get_base_speed_for("monster")
	var m_spd_text := "SPD:" + str(m_spd)
	if m_spd != m_base_spd:
		m_spd_text += "(" + str(m_base_spd) + ")"
	var m_text := "DMG:" + str(m_dmg) + " DEF:" + str(m_def) + " " + m_spd_text
	if m_eva > 0:
		m_text += " EVA:" + str(m_eva) + "%"
	if m_tier > 0:
		m_text += " T" + str(m_tier)
	monster_stats_lbl.text = m_text
	if _compact_font:
		monster_stats_lbl.add_theme_font_override("font", _compact_font)
	monster_stats_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	monster_stats_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_HP_RED)


# ── Signal handlers ──────────────────────────────────────────────────

func _on_phase_changed(new_phase: String) -> void:
	_update_buttons()


func _on_turn_started(actor: String, tn: int) -> void:
	_current_turn = tn
	_current_actor = actor
	if actor == "hero":
		turn_label.text = "T" + str(tn) + " Your turn"
		turn_label.add_theme_color_override("font_color", ThemeManager.COLOR_HP_GREEN)
		_animate_flash(hero_sprite, ThemeManager.COLOR_HP_GREEN, 0.2)
		_update_buttons()
	elif actor == "monster":
		var mname: String = str(_engine.monster.get("name", "Monster"))
		if mname.length() > 12:
			mname = mname.substr(0, 12)
		turn_label.text = "T" + str(tn) + " " + mname + "..."
		turn_label.add_theme_color_override("font_color", ThemeManager.COLOR_HP_RED)
		_animate_flash(monster_sprite, ThemeManager.COLOR_HP_RED, 0.2)
		var dur := ANIM_ATTACK
		if _engine.auto_battle:
			dur *= ANIM_AUTO_MULT
		_animate_lunge(monster_sprite, MONSTER_BASE_X, HERO_BASE_X, dur)
	elif actor == "companion":
		turn_label.text = "T" + str(tn) + " " + _engine.comp_name + "..."
		turn_label.add_theme_color_override("font_color", ThemeManager.COLOR_MANA_BLUE)
		if companion_sprite:
			_animate_flash(companion_sprite, ThemeManager.COLOR_MANA_BLUE, 0.2)
			var dur := ANIM_ATTACK * 0.7
			if _engine.auto_battle:
				dur *= ANIM_AUTO_MULT
			_animate_lunge(companion_sprite, companion_sprite.position.x, MONSTER_BASE_X, dur)

	# Update turn order strip and mirror to info line
	_update_turn_order_display()
	_turn_info_text = turn_label.text
	_update_info_line()


func _on_action_resolved(action: String, result: Dictionary) -> void:
	var duration := ANIM_ATTACK
	match action:
		"attack": duration = ANIM_ATTACK
		"skill": duration = ANIM_SKILL
		"ultimate": duration = ANIM_ULT
		"potion": duration = ANIM_POTION
		"flee": duration = ANIM_FLEE

	if _engine.auto_battle:
		duration *= ANIM_AUTO_MULT

	# Refresh turn order after any action
	_update_turn_order_display()

	match action:
		"attack":
			# Only lunge for melee weapons; ranged weapons flash instead
			var weapon_range := GameState.get_weapon_range_type()
			if weapon_range == "ranged":
				_animate_flash(hero_sprite, Color(0.5, 0.7, 1.0), duration)
			else:
				_animate_lunge(hero_sprite, HERO_BASE_X, MONSTER_BASE_X, duration)
		"skill":
			var skill_idx: int = int(result.get("skill_idx", -1))
			var vfx: Dictionary = SKILL_VFX.get(skill_idx, {})
			if not vfx.is_empty():
				var target: String = str(vfx.get("target", "monster"))
				if target == "monster":
					_animate_lunge(hero_sprite, HERO_BASE_X, MONSTER_BASE_X, duration)
					_spawn_spell_flash(monster_sprite.position + Vector2(0, float(vfx.get("offset_y", 0))), str(vfx["tex"]))
				else:
					_animate_flash(hero_sprite, Color(0.4, 0.8, 1.0), duration)
					_spawn_spell_flash(hero_sprite.position + Vector2(0, float(vfx.get("offset_y", 0))), str(vfx["tex"]))
				var tint: Color = vfx.get("tint", Color.TRANSPARENT)
				if tint.a > 0:
					_spawn_screen_flash(tint)
				# Arcane Drain: also show heal bolt at hero
				if skill_idx == 12:
					_spawn_spell_flash(hero_sprite.position, "res://assets/sprites/generated/vfx/vfx_light_bolt.png")
			else:
				_animate_lunge(hero_sprite, HERO_BASE_X, MONSTER_BASE_X, duration)
		"ultimate":
			var ult_idx: int = int(result.get("ult_idx", -1))
			var vfx: Dictionary = ULT_VFX.get(ult_idx, {})
			_animate_lunge(hero_sprite, HERO_BASE_X, MONSTER_BASE_X, duration)
			if not vfx.is_empty():
				var target: String = str(vfx.get("target", "monster"))
				var target_pos: Vector2 = monster_sprite.position if target == "monster" else hero_sprite.position
				var multi: int = int(vfx.get("multi", 1))
				for j in range(multi):
					var spawn_pos := target_pos + (Vector2(randf_range(-10, 10), randf_range(-10, 10)) if multi > 1 else Vector2.ZERO)
					if j == 0:
						_spawn_spell_flash(spawn_pos, str(vfx["tex"]), 1.5)
					else:
						get_tree().create_timer(float(j) * 0.08).timeout.connect(_spawn_spell_flash.bind(spawn_pos, str(vfx["tex"]), 1.5))
				var flash_color: Color = vfx.get("flash", Color.TRANSPARENT)
				if flash_color.a > 0:
					_spawn_screen_flash(flash_color)
				var shake: float = float(vfx.get("shake", 0))
				if shake > 0:
					_screen_shake(shake, 0.3)
		"potion":
			_animate_flash(hero_sprite, Color(0.3, 0.8, 0.3), duration)
			_spawn_spell_flash(hero_sprite.position, "res://assets/sprites/generated/vfx/vfx_light_bolt.png")


func _on_damage_dealt(source_id: String, target_id: String, amount: int, info: Dictionary) -> void:
	if info.get("evaded", false):
		_spawn_float_text("MISS", _get_sprite_pos(target_id), ThemeManager.COLOR_TEXT_DIM)
		return
	if info.get("shielded", false) or info.get("blocked", false):
		_spawn_float_text("BLOCKED", _get_sprite_pos(target_id), ThemeManager.COLOR_ACCENT_TEAL)
		return

	var color := Color(1.0, 0.3, 0.3) if target_id == "hero" else Color(1.0, 0.9, 0.3)
	var text := str(amount)
	if info.get("crit", false):
		text += "!"
		color = Color(1.0, 0.6, 0.1)
	if info.get("riposte", false):
		_spawn_float_text("RIPOSTE " + text, _get_sprite_pos(target_id), Color(1.0, 0.7, 0.2))
		if amount > 0:
			_spawn_hit_sparks(_get_sprite_pos(target_id), amount)
			_screen_shake(2.0, 0.15)
		return
	if info.get("death_mark", false):
		_spawn_float_text("DETONATE " + text, _get_sprite_pos(target_id), Color(0.6, 0.3, 1.0))
		if amount > 0:
			_spawn_hit_sparks(_get_sprite_pos(target_id), amount)
			_screen_shake(3.0, 0.2)
			_spawn_screen_flash(Color(0.5, 0.2, 1.0, 0.3))
		return
	_spawn_float_text(text, _get_sprite_pos(target_id), color)

	# Hit sparks + hurt flash
	if amount > 0:
		_spawn_hit_sparks(_get_sprite_pos(target_id), amount)
		if target_id == "monster":
			_animate_flash(monster_sprite, Color(1.0, 0.4, 0.4), 0.15)
		elif target_id == "hero":
			_animate_flash(hero_sprite, Color(1.0, 0.4, 0.4), 0.15)
		if info.get("crit", false):
			_screen_shake(2.0, 0.15)

	_update_hud()


func _on_status_changed(_target_id: String, _statuses: Array) -> void:
	_update_buff_display()
	_update_stat_row()


func _on_combat_ended(result: String) -> void:
	_result = result
	_update_buttons()
	if result == "victory" and monster_sprite:
		monster_sprite.play_death(0.5)
		_screen_shake(3.0, 0.3)
		await get_tree().create_timer(0.6).timeout
	elif result == "defeat" and hero_sprite:
		hero_sprite.play_death(0.5)
		await get_tree().create_timer(0.6).timeout
	_show_result_overlay(result)


func _on_telegraph_shown(_special_id: String, telegraph_text: String, _icon: String) -> void:
	telegraph_panel.visible = true
	telegraph_label.text = telegraph_text
	telegraph_label.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)


func _on_telegraph_cleared() -> void:
	telegraph_panel.visible = false


func _on_log_added(text: String, msg_type: String) -> void:
	var color := "#e8d4a8"
	match msg_type:
		"combat": color = "#ffda66"
		"buff": color = "#4ecdc4"
		"debuff": color = "#ff8844"
		"heal": color = "#4a8a4a"
		"bad": color = "#c04040"
		"warning": color = "#ffda66"
		"dot": color = "#aa6644"
		"ult": color = "#dd88ff"
		"info": color = "#9a8a6a"
	var prefix := "[color=#8a7a50]T" + str(_current_turn) + "[/color] "
	combat_log.append_text(prefix + "[color=" + color + "]" + text + "[/color]\n")

	# SFX triggers
	var _sfx_mgr := get_node_or_null("/root/SfxManager")
	if _sfx_mgr:
		match msg_type:
			"combat":
				if "CRIT" in text:
					_play_sfx_throttled(_sfx_crit)
				else:
					_play_sfx_throttled(_sfx_hit)
			"heal":
				_play_sfx_throttled(_sfx_heal, 0.3)
			"ult":
				_play_sfx_throttled(_sfx_skill, 0.3)


func _on_hp_changed() -> void:
	_update_hud()


func _on_companion_died() -> void:
	companion_hp_bar.visible = false
	if companion_sprite:
		companion_sprite.play_death(0.4)


func _build_turn_order_strip() -> void:
	# Build horizontal turn order preview strip programmatically
	_turn_order_container = HBoxContainer.new()
	_turn_order_container.add_theme_constant_override("separation", 2)
	# Place it in the HUD layer — after turn label area
	var hud := get_node("HUD")

	# Wrapper to hold label + slots on the same line
	var wrapper := HBoxContainer.new()
	wrapper.add_theme_constant_override("separation", 4)
	wrapper.position = Vector2(4, 244)
	wrapper.size = Vector2(632, 14)
	wrapper.name = "TurnOrderRow"
	hud.add_child(wrapper)

	var order_lbl := Label.new()
	order_lbl.text = "NEXT:"
	if _compact_font:
		order_lbl.add_theme_font_override("font", _compact_font)
	order_lbl.add_theme_font_size_override("font_size", 7)
	order_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	wrapper.add_child(order_lbl)

	wrapper.add_child(_turn_order_container)

	_turn_order_slots.clear()
	_turn_order_labels.clear()
	for i in range(5):
		var slot := PanelContainer.new()
		slot.custom_minimum_size = Vector2(50, 12)
		var style := StyleBoxFlat.new()
		style.bg_color = Color(0.08, 0.08, 0.15, 0.9)
		style.border_color = Color.GRAY
		style.set_border_width_all(1)
		style.set_corner_radius_all(1)
		style.set_content_margin_all(1)
		slot.add_theme_stylebox_override("panel", style)

		var lbl := Label.new()
		lbl.text = "..."
		if _compact_font:
			lbl.add_theme_font_override("font", _compact_font)
		lbl.add_theme_font_size_override("font_size", 7)
		lbl.add_theme_color_override("font_color", Color.WHITE)
		lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		slot.add_child(lbl)

		_turn_order_container.add_child(slot)
		_turn_order_slots.append(slot)
		_turn_order_labels.append(lbl)

	# Shift ActionBar, SkillInfoLabel, TurnLabel, and CombatLog down to make room
	for shift_node_path in ["HUD/ActionBar"]:
		var n := get_node_or_null(shift_node_path)
		if n:
			n.offset_top += 14
			n.offset_bottom += 14
	if skill_info_lbl:
		skill_info_lbl.offset_top += 14
		skill_info_lbl.offset_bottom += 14
	if turn_label:
		turn_label.offset_top += 14
		turn_label.offset_bottom += 14
	_update_turn_order_display()


func _update_turn_order_display() -> void:
	if _turn_order_slots.is_empty():
		return
	var timeline: Array[String] = _engine.calc_timeline_preview(5)
	for i in range(5):
		if i >= timeline.size():
			_turn_order_labels[i].text = "..."
			var style: StyleBoxFlat = _turn_order_slots[i].get_theme_stylebox("panel") as StyleBoxFlat
			if style:
				style.border_color = Color(0.3, 0.3, 0.3)
			continue

		var actor_id: String = timeline[i]
		var display_name: String = ""
		var border_color: Color = Color.GRAY
		var text_color: Color = Color.WHITE

		match actor_id:
			"hero":
				display_name = "YOU"
				border_color = ThemeManager.COLOR_HP_GREEN
				text_color = ThemeManager.COLOR_HP_GREEN
			"monster":
				var mname: String = str(_engine.monster.get("name", "Monster"))
				display_name = mname.substr(0, 6) if mname.length() > 6 else mname
				border_color = ThemeManager.COLOR_HP_RED
				text_color = ThemeManager.COLOR_HP_RED
			"companion":
				var cname: String = _engine.comp_name
				display_name = cname.substr(0, 6) if cname.length() > 6 else cname
				border_color = ThemeManager.COLOR_MANA_BLUE
				text_color = ThemeManager.COLOR_MANA_BLUE

		# First slot = gold border (current turn)
		if i == 0:
			border_color = ThemeManager.COLOR_GOLD_BRIGHT

		_turn_order_labels[i].text = display_name
		_turn_order_labels[i].add_theme_color_override("font_color", text_color)

		var style: StyleBoxFlat = _turn_order_slots[i].get_theme_stylebox("panel") as StyleBoxFlat
		if style:
			style.border_color = border_color


func _toggle_combat_log() -> void:
	_log_visible = not _log_visible
	combat_log.visible = _log_visible
	if _log_visible:
		log_btn.text = "[Log]"
		ThemeManager.style_button(log_btn, ThemeManager.COLOR_SUCCESS_GREEN)
	else:
		log_btn.text = "Log"
		ThemeManager.style_button(log_btn)


func _unhandled_input(event: InputEvent) -> void:
	if not _log_visible:
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		# Dismiss log on click anywhere outside the log button
		if not log_btn.get_global_rect().has_point(event.position):
			_toggle_combat_log()
			get_viewport().set_input_as_handled()


func _style_hud() -> void:
	# Color HP bars with themed fills
	_style_progress_bar(hero_hp_bar, ThemeManager.COLOR_HP_GREEN, Color(0.05, 0.10, 0.05))
	_style_progress_bar(monster_hp_bar, ThemeManager.COLOR_HP_RED, Color(0.15, 0.05, 0.05))
	_style_progress_bar(hero_resource, ThemeManager.COLOR_MANA_BLUE, Color(0.05, 0.05, 0.15))
	_style_progress_bar(companion_hp_bar, ThemeManager.COLOR_ACCENT_TEAL, Color(0.05, 0.10, 0.15))

	# Name label styling — explicit font override for pixel-crisp rendering
	if _compact_font:
		hero_name_lbl.add_theme_font_override("font", _compact_font)
		monster_name_lbl.add_theme_font_override("font", _compact_font)
	hero_name_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	hero_name_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_HP_GREEN)
	monster_name_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	monster_name_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_HP_RED)

	# Turn label styling
	if _compact_font:
		turn_label.add_theme_font_override("font", _compact_font)
	turn_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])

	# Combat log — positioned between fighters, very transparent
	combat_log.offset_left = 190.0
	combat_log.offset_right = 450.0
	combat_log.offset_top = 50.0
	combat_log.offset_bottom = 195.0
	var log_style := StyleBoxFlat.new()
	log_style.bg_color = Color(0.04, 0.04, 0.08, 0.35)
	log_style.set_content_margin_all(4)
	log_style.set_border_width_all(1)
	log_style.border_color = Color(ThemeManager.COLOR_BORDER_GOLD, 0.2)
	log_style.set_corner_radius_all(2)
	combat_log.add_theme_stylebox_override("normal", log_style)
	combat_log.modulate.a = 0.85
	if _compact_font:
		combat_log.add_theme_font_override("normal_font", _compact_font)
	combat_log.add_theme_font_size_override("normal_font_size", ThemeManager.FONT_SIZES["body"])

	# Status panels dark background
	var sp_style := ThemeManager.make_inset_style(0.95)
	hero_status_panel.add_theme_stylebox_override("panel", sp_style)
	monster_status_panel.add_theme_stylebox_override("panel", sp_style.duplicate())

	# Telegraph panel styling
	var tp_style := StyleBoxFlat.new()
	tp_style.bg_color = Color(0.10, 0.08, 0.15, 0.95)
	tp_style.border_color = ThemeManager.COLOR_GOLD_BRIGHT
	tp_style.set_border_width_all(1)
	tp_style.set_corner_radius_all(1)
	tp_style.set_content_margin_all(4)
	telegraph_panel.add_theme_stylebox_override("panel", tp_style)

	# Dark bottom strip behind combat log + turn label + buttons
	var bottom_bg := ColorRect.new()
	bottom_bg.color = Color(0.08, 0.08, 0.15, 0.9)
	bottom_bg.position = Vector2(0, 345)
	bottom_bg.size = Vector2(960, 195)
	bottom_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	get_node("HUD").add_child(bottom_bg)
	get_node("HUD").move_child(bottom_bg, 0)

	# Dark top strip behind HP bars + resource row
	var top_bg := ColorRect.new()
	top_bg.color = Color(0.08, 0.08, 0.15, 0.7)
	top_bg.position = Vector2(0, 0)
	top_bg.size = Vector2(960, 45)
	top_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	get_node("HUD").add_child(top_bg)
	get_node("HUD").move_child(top_bg, 0)


func _style_progress_bar(bar: ProgressBar, fill_color: Color, bg_color: Color) -> void:
	# Fill — brighter top edge for a subtle gradient/bevel effect
	var fill := StyleBoxFlat.new()
	fill.bg_color = fill_color
	fill.border_color = fill_color.lightened(0.3)
	fill.border_width_top = 1
	fill.border_width_bottom = 0
	fill.border_width_left = 0
	fill.border_width_right = 0
	fill.set_corner_radius_all(0)
	fill.set_content_margin_all(0)
	bar.add_theme_stylebox_override("fill", fill)
	# Background — dark with gold border
	var bg := StyleBoxFlat.new()
	bg.bg_color = bg_color
	bg.border_color = ThemeManager.COLOR_BORDER_GOLD
	bg.set_border_width_all(1)
	bg.set_corner_radius_all(0)
	bg.set_content_margin_all(0)
	bar.add_theme_stylebox_override("background", bg)
	# Overlay HP frame texture if available
	var frame_tex = load("res://assets/sprites/generated/vfx/vfx_hp_frame.png")
	if frame_tex:
		# Remove existing frame overlay if re-styling
		var old_frame := bar.get_node_or_null("FrameOverlay")
		if old_frame:
			old_frame.queue_free()
		var frame := TextureRect.new()
		frame.name = "FrameOverlay"
		frame.texture = frame_tex
		frame.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		frame.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		frame.stretch_mode = TextureRect.STRETCH_SCALE
		frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
		bar.add_child(frame)


func _setup_action_icons() -> void:
	var class_key: String = str(_engine.hero.get("class_key", "barbarian"))
	var class_color: Color = ThemeManager.get_class_color(class_key)

	# ATK button: weapon icon + "ATK" text
	var weapon_data: Dictionary = _gs.equipment.get("weapon", {})
	var weapon_key: String = str(weapon_data.get("base_key", ""))
	if not weapon_key.is_empty():
		var tex := IconMap.get_item_icon(weapon_key)
		if tex:
			atk_btn.icon = tex
	atk_btn.text = "ATK"
	atk_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	_skill_info[atk_btn] = "Basic Attack"
	ThemeManager.style_button(atk_btn, class_color)

	# Skill 0 button: icon + truncated name + cost
	var s0 := _engine.get_skill_info(0)
	if not s0.is_empty():
		var sname: String = str(s0.get("name", "Skill"))
		var cost: int = int(s0.get("cost", 0))
		var sid: String = str(s0.get("id", ""))
		skill0_btn.text = _truncate(sname, 8) + (" " + str(cost) if cost > 0 else "")
		_skill_info[skill0_btn] = sname + ": " + str(s0.get("dungeon_desc", s0.get("desc", "")))
		if not sid.is_empty():
			var s0_tex := IconMap.get_skill_icon(sid)
			if s0_tex:
				skill0_btn.icon = s0_tex
	else:
		skill0_btn.text = "S1"
	skill0_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_button(skill0_btn, class_color)

	# Skill 1 button: icon + truncated name + cost
	var s1 := _engine.get_skill_info(1)
	if not s1.is_empty():
		var sname: String = str(s1.get("name", "Skill"))
		var cost: int = int(s1.get("cost", 0))
		var sid1: String = str(s1.get("id", ""))
		skill1_btn.text = _truncate(sname, 8) + (" " + str(cost) if cost > 0 else "")
		_skill_info[skill1_btn] = sname + ": " + str(s1.get("dungeon_desc", s1.get("desc", "")))
		if not sid1.is_empty():
			var s1_tex := IconMap.get_skill_icon(sid1)
			if s1_tex:
				skill1_btn.icon = s1_tex
	else:
		skill1_btn.text = "S2"
	skill1_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_button(skill1_btn, class_color)

	# Ultimate button: icon + truncated name
	var ult := _engine.get_ult_info()
	if not ult.is_empty():
		var uname: String = str(ult.get("name", "Ultimate"))
		var uid: String = str(ult.get("id", ""))
		ult_btn.text = _truncate(uname, 10)
		_skill_info[ult_btn] = uname + ": " + str(ult.get("dungeon_desc", ult.get("desc", "")))
		if not uid.is_empty():
			var ult_tex := IconMap.get_skill_icon(uid)
			if ult_tex:
				ult_btn.icon = ult_tex
	else:
		ult_btn.text = "ULT"
	ult_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	ThemeManager.style_button(ult_btn, class_color)

	# Potion button: "Pot(N)"
	var pot_count: int = int(_engine.run.get("potions", 0))
	pot_btn.text = "Pot(" + str(pot_count) + ")"
	var pot_tex = load("res://assets/sprites/generated/gear/event_potion.png")
	if pot_tex:
		pot_btn.icon = pot_tex
	pot_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	_skill_info[pot_btn] = "Use Health Potion"

	# Companion button: name or "---"
	comp_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	_skill_info[comp_btn] = "Companion"
	if _engine.has_companion:
		_skill_info[comp_btn] = "Companion: " + _engine.comp_name

	# Flee + Auto + Log
	flee_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	_skill_info[flee_btn] = "Attempt to flee combat"
	auto_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	_skill_info[auto_btn] = "Toggle auto battle"
	log_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	_skill_info[log_btn] = "Toggle combat log overlay"

	# Use scene-defined skill info label (dual-purpose: turn info + hover descriptions)
	_skill_info_label = skill_info_lbl
	if _compact_font:
		_skill_info_label.add_theme_font_override("font", _compact_font)
	_skill_info_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	_skill_info_label.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
	_skill_info_label.visible = true
	for btn in [atk_btn, skill0_btn, skill1_btn, ult_btn, pot_btn, comp_btn, flee_btn, auto_btn, log_btn]:
		btn.mouse_entered.connect(_show_skill_info.bind(btn))
		btn.mouse_exited.connect(_hide_skill_info)


func _truncate(s: String, max_len: int) -> String:
	if s.length() <= max_len:
		return s
	return s.substr(0, max_len)


# ── UI Updates ───────────────────────────────────────────────────────

func _update_hud() -> void:
	hero_hp_bar.value = _engine.get_hero_hp_pct() * 100.0
	monster_hp_bar.value = _engine.get_monster_hp_pct() * 100.0
	hero_resource.value = _engine.get_mana_pct() * 100.0

	if _engine.has_companion and _engine.comp_alive:
		companion_hp_bar.value = _engine.get_comp_hp_pct() * 100.0

	# HP number overlays on bars (clean names stay without HP numbers)
	var h_hp: int = maxi(0, int(_engine.hero.get("hp", 0)))
	var h_max: int = maxi(1, int(_engine.hero.get("max_hp", 1)))
	var h_hp_text: Label = hero_hp_bar.get_node_or_null("HpText")
	if h_hp_text:
		h_hp_text.text = str(h_hp) + "/" + str(h_max)

	var m_hp: int = maxi(0, int(_engine.monster.get("hp", 0)))
	var m_max: int = maxi(1, int(_engine.monster.get("max_hp", 1)))
	var m_hp_text: Label = monster_hp_bar.get_node_or_null("HpText")
	if m_hp_text:
		m_hp_text.text = str(m_hp) + "/" + str(m_max)

	# Resource bar number overlay
	var mana: int = maxi(0, int(_engine.hero.get("mana", 0)))
	var max_mana: int = maxi(1, int(_engine.hero.get("max_mana", 1)))
	var res_text: Label = hero_resource.get_node_or_null("ResText")
	if res_text:
		res_text.text = str(mana) + "/" + str(max_mana)

	# Companion HP overlay
	if _engine.has_companion and _engine.comp_alive:
		var comp_text: Label = companion_hp_bar.get_node_or_null("CompText")
		if comp_text:
			var c_hp: int = maxi(0, roundi(float(_engine.hero.get("comp_hp", 0)) if _engine.hero.has("comp_hp") else 0))
			var c_max: int = maxi(1, roundi(float(_engine.hero.get("comp_max_hp", 1)) if _engine.hero.has("comp_max_hp") else 1))
			# Use companion data from engine if available
			for cmb in _engine.combatants:
				if str(cmb.get("id", "")) == "companion":
					c_hp = maxi(0, int(cmb.get("hp", 0)))
					c_max = maxi(1, int(cmb.get("max_hp", 1)))
					break
			comp_text.text = str(c_hp) + "/" + str(c_max)

	# Update potion count text
	pot_btn.text = "Pot(" + str(int(_engine.run.get("potions", 0))) + ")"


func _update_buttons() -> void:
	var can_act := _engine.phase == "pick"
	atk_btn.disabled = not can_act
	skill0_btn.disabled = not (can_act and _engine.can_use_skill(0))
	skill1_btn.disabled = not (can_act and _engine.can_use_skill(1))
	ult_btn.disabled = not (can_act and _engine.can_use_ultimate())
	pot_btn.disabled = not (can_act and _engine.can_use_potion())
	flee_btn.disabled = not can_act

	# Grey out disabled buttons, brighten enabled ones
	for btn in [atk_btn, skill0_btn, skill1_btn, ult_btn, pot_btn]:
		btn.modulate = Color(0.4, 0.4, 0.4) if btn.disabled else Color.WHITE
	flee_btn.modulate = Color(0.5, 0.5, 0.5) if flee_btn.disabled else Color.WHITE
	comp_btn.modulate = Color(0.5, 0.5, 0.5)

	# Show mana cost or cooldown on disabled skill buttons
	_update_cost_overlay(skill0_btn, 0)
	_update_cost_overlay(skill1_btn, 1)
	_update_skill_labels()

	# Auto button always enabled — highlight clearly when active
	auto_btn.disabled = false
	if _engine.auto_battle:
		auto_btn.text = "[A]"
		auto_btn.add_theme_color_override("font_color", ThemeManager.COLOR_SUCCESS_GREEN)
		var auto_style := StyleBoxFlat.new()
		auto_style.bg_color = Color(0.10, 0.18, 0.15)
		auto_style.border_color = ThemeManager.COLOR_SUCCESS_GREEN
		auto_style.set_border_width_all(1)
		auto_style.set_corner_radius_all(1)
		auto_style.content_margin_left = 4
		auto_style.content_margin_right = 4
		auto_style.content_margin_top = 3
		auto_style.content_margin_bottom = 3
		auto_btn.add_theme_stylebox_override("normal", auto_style)
	else:
		auto_btn.text = "Auto"
		auto_btn.remove_theme_color_override("font_color")
		auto_btn.remove_theme_stylebox_override("normal")


func _update_skill_labels() -> void:
	var s0 := _engine.get_skill_info(0)
	if not s0.is_empty():
		var cd0: int = _engine.get_skill_cooldown(0)
		var cd0_text := " [" + str(cd0) + "T cd]" if cd0 > 0 else ""
		_skill_info[skill0_btn] = str(s0.get("name", "")) + ": " + str(s0.get("dungeon_desc", s0.get("desc", ""))) + cd0_text
	var s1 := _engine.get_skill_info(1)
	if not s1.is_empty():
		var cd1: int = _engine.get_skill_cooldown(1)
		var cd1_text := " [" + str(cd1) + "T cd]" if cd1 > 0 else ""
		_skill_info[skill1_btn] = str(s1.get("name", "")) + ": " + str(s1.get("dungeon_desc", s1.get("desc", ""))) + cd1_text
	var ult := _engine.get_ult_info()
	if not ult.is_empty():
		_skill_info[ult_btn] = str(ult.get("name", "")) + ": " + str(ult.get("dungeon_desc", ult.get("desc", "")))


func _show_skill_info(btn: Button) -> void:
	var info: String = _skill_info.get(btn, "")
	if not info.is_empty() and _skill_info_label:
		_hovering_skill = true
		_skill_info_label.text = info
		_skill_info_label.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
		_skill_info_label.visible = true


func _hide_skill_info() -> void:
	_hovering_skill = false
	_update_info_line()


func _update_info_line() -> void:
	if not _skill_info_label or _hovering_skill:
		return
	if _turn_info_text.is_empty():
		_skill_info_label.visible = false
	else:
		_skill_info_label.text = _turn_info_text
		_skill_info_label.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_DIM)
		_skill_info_label.visible = true


func _update_buff_display() -> void:
	# Clear old buff indicators (buff squares only — stat panels are static)
	for c in hero_buffs.get_children():
		c.queue_free()
	for c in monster_buffs.get_children():
		c.queue_free()

	# Hero statuses — colored squares in buff row
	var hero_statuses: Array = _engine._get_hero_statuses()
	for s in hero_statuses:
		var color := Color.html(str(s.get("color", "#ffffff")))
		var turns: int = int(s.get("turns", 0))
		_add_buff_square(hero_buffs, color, turns)

	# Monster statuses — colored squares in buff row
	var monster_statuses: Array = _engine._get_monster_statuses()
	for s in monster_statuses:
		var color := Color.html(str(s.get("color", "#ffffff")))
		var turns: int = int(s.get("turns", 0))
		_add_buff_square(monster_buffs, color, turns)


func _add_buff_square(container: HBoxContainer, color: Color, turns: int) -> void:
	var holder := Control.new()
	holder.custom_minimum_size = Vector2(8, 8)
	var square := ColorRect.new()
	square.color = color
	square.position = Vector2(1, 1)
	square.size = Vector2(6, 6)
	holder.add_child(square)
	if turns > 0:
		var t_lbl := Label.new()
		t_lbl.text = str(turns)
		t_lbl.add_theme_font_size_override("font_size", 6)
		t_lbl.add_theme_color_override("font_color", Color.WHITE)
		t_lbl.position = Vector2(0, -2)
		holder.add_child(t_lbl)
	container.add_child(holder)


func _update_cost_overlay(btn: Button, skill_idx: int) -> void:
	# Remove old cost label if present
	var old := btn.get_node_or_null("CostLabel")
	if old:
		old.queue_free()

	if not btn.disabled:
		return
	var info := _engine.get_skill_info(skill_idx)
	if info.is_empty():
		return

	var cd: int = _engine.get_skill_cooldown(skill_idx)
	var cost: int = int(info.get("cost", 0))

	# Show cooldown "2T" in gold when on cooldown, else mana cost in blue
	if cd > 0:
		var cd_lbl := Label.new()
		cd_lbl.name = "CostLabel"
		cd_lbl.text = str(cd) + "T"
		if _compact_font:
			cd_lbl.add_theme_font_override("font", _compact_font)
		cd_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		cd_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
		cd_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		cd_lbl.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
		cd_lbl.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		btn.add_child(cd_lbl)
	elif cost > 0:
		var cost_lbl := Label.new()
		cost_lbl.name = "CostLabel"
		cost_lbl.text = str(cost)
		if _compact_font:
			cost_lbl.add_theme_font_override("font", _compact_font)
		cost_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		cost_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_MANA_BLUE)
		cost_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		cost_lbl.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
		cost_lbl.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		btn.add_child(cost_lbl)


# ── Animations ───────────────────────────────────────────────────────

func _animate_lunge(sprite: Node2D, from_x: float, toward_x: float, duration: float) -> void:
	if not sprite:
		return
	if sprite is LayeredSprite:
		sprite.play_attack(toward_x, duration)
	else:
		var lunge_dist := (toward_x - from_x) * 0.3
		if _anim_tween:
			_anim_tween.kill()
		_anim_tween = create_tween()
		_anim_tween.tween_property(sprite, "position:x", from_x + lunge_dist, duration * 0.5)
		_anim_tween.tween_property(sprite, "position:x", from_x, duration * 0.5)


func _animate_flash(sprite: Node2D, color: Color, duration: float) -> void:
	if not sprite:
		return
	if sprite is LayeredSprite:
		sprite.play_hurt(duration)
	else:
		var original := sprite.modulate
		sprite.modulate = color
		get_tree().create_timer(duration).timeout.connect(func(): sprite.modulate = original)


func _spawn_float_text(text: String, pos: Vector2, color: Color, category: String = "normal") -> void:
	var lbl := Label.new()
	lbl.text = text

	# Infer category if not provided
	if category == "normal":
		if text == "MISS" or text == "RESIST":
			category = "miss"
		elif text == "BLOCKED":
			category = "info"
		elif text.begins_with("RIPOSTE") or text.begins_with("DETONATE"):
			category = "info"
		elif text.ends_with("!"):
			category = "crit"
		elif text.is_valid_int() and text.to_int() > 200:
			category = "big"

	# Category-based font size
	var font_size: int
	match category:
		"crit": font_size = 20
		"big": font_size = 18
		"miss": font_size = 14
		"info": font_size = 14
		"heal": font_size = 16
		_: font_size = 16

	# LabelSettings for crisp outlines
	var ls := LabelSettings.new()
	if _compact_font:
		ls.font = _compact_font
	ls.font_size = font_size
	ls.font_color = color
	ls.outline_size = 1
	ls.outline_color = Color(0, 0, 0, 0.9)
	ls.shadow_size = 1
	ls.shadow_color = Color(0, 0, 0, 0.5)
	ls.shadow_offset = Vector2(1, 1)
	lbl.label_settings = ls

	lbl.position = pos + Vector2(randf_range(-10, 10), -10)
	float_container.add_child(lbl)

	# Category-based animation
	var drift: float
	var duration: float
	match category:
		"crit":
			drift = -40.0
			duration = 1.0
		"big":
			drift = -35.0
			duration = 0.9
		"miss":
			drift = -20.0
			duration = 0.5
		_:
			drift = -30.0
			duration = 0.8

	var tw := create_tween()
	if category == "crit" or category == "big":
		lbl.scale = Vector2(0.3, 0.3)
		lbl.pivot_offset = Vector2(lbl.size.x / 2, lbl.size.y / 2)
		tw.tween_property(lbl, "scale", Vector2(1.3, 1.3), 0.1)
		tw.tween_property(lbl, "scale", Vector2(1.0, 1.0), 0.1)
		tw.tween_property(lbl, "position:y", lbl.position.y + drift, duration - 0.5)
		tw.tween_property(lbl, "modulate:a", 0.0, 0.3)
	else:
		tw.tween_property(lbl, "position:y", lbl.position.y + drift, duration)
		tw.parallel().tween_property(lbl, "modulate:a", 0.0, duration)
	tw.tween_callback(lbl.queue_free)


func _get_sprite_pos(target_id: String) -> Vector2:
	if target_id == "hero":
		return hero_sprite.position
	elif target_id == "monster":
		return monster_sprite.position
	elif target_id == "companion" and companion_sprite:
		return companion_sprite.position
	return Vector2(192, 80)


func _spawn_hit_sparks(pos: Vector2, amount: int) -> void:
	var count := clampi(roundi(float(amount) / 100.0), 2, 6)
	for i in range(count):
		var spark := ColorRect.new()
		spark.size = Vector2(2, 2)
		spark.position = pos + Vector2(randf_range(-6, 6), randf_range(-4, 4))
		spark.color = Color(1.0, 0.8 + randf() * 0.2, 0.3, 1.0)
		spark.mouse_filter = Control.MOUSE_FILTER_IGNORE
		float_container.add_child(spark)
		var tw := create_tween()
		var dir := Vector2(randf_range(-12, 12), randf_range(-16, -4))
		tw.tween_property(spark, "position", spark.position + dir, 0.3 + randf() * 0.15)
		tw.parallel().tween_property(spark, "modulate:a", 0.0, 0.3 + randf() * 0.15)
		tw.tween_callback(spark.queue_free)


func _spawn_spell_flash(pos: Vector2, tex_path: String, scale_mult: float = 1.0) -> void:
	var tex = load(tex_path)
	if not tex:
		return
	var sprite := Sprite2D.new()
	sprite.texture = tex
	sprite.position = pos + Vector2(0, -5)
	sprite.scale = Vector2(0.15, 0.15) * scale_mult
	sprite.modulate.a = 0.85
	float_container.add_child(sprite)
	var tw := create_tween()
	tw.tween_property(sprite, "scale", Vector2(0.3, 0.3) * scale_mult, 0.25)
	tw.parallel().tween_property(sprite, "modulate:a", 0.0, 0.35)
	tw.tween_callback(sprite.queue_free)


func _screen_shake(intensity: float, duration: float) -> void:
	var battle_area: Node2D = %FloatContainer.get_parent()
	var origin := battle_area.position
	var tw := create_tween()
	var steps := 6
	for i in range(steps):
		var fade := 1.0 - float(i) / float(steps)
		var offset_x := randf_range(-intensity, intensity) * fade
		var offset_y := randf_range(-intensity * 0.5, intensity * 0.5) * fade
		tw.tween_property(battle_area, "position", origin + Vector2(offset_x, offset_y), duration / float(steps))
	tw.tween_property(battle_area, "position", origin, 0.02)


func _spawn_status_particle(sprite_pos: Vector2, config: Dictionary) -> void:
	var count := randi_range(1, 2)
	for _i in count:
		var particle := ColorRect.new()
		var sz := randf_range(1.5, 3.0)
		particle.size = Vector2(sz, sz)
		var base_color: Color = config.get("color", Color.WHITE)
		particle.color = base_color.lightened(randf_range(0.0, 0.2))
		var offset_y: float = float(config.get("offset_y", 0))
		var spread_x: float = float(config.get("spread_x", 8))
		particle.position = sprite_pos + Vector2(randf_range(-spread_x, spread_x), offset_y + randf_range(-3, 3))
		particle.mouse_filter = Control.MOUSE_FILTER_IGNORE
		float_container.add_child(particle)
		var dir_y: float = float(config.get("dir_y", -10))
		var tw := create_tween()
		tw.tween_property(particle, "position:y", particle.position.y + dir_y, randf_range(0.5, 0.8))
		tw.parallel().tween_property(particle, "modulate:a", 0.0, randf_range(0.5, 0.8))
		tw.tween_callback(particle.queue_free)


# ── Action submission ────────────────────────────────────────────────

func _submit(action: String) -> void:
	if _engine.phase == "done" and action != "_auto":
		return
	_engine.submit_action(action)

	# For monster/companion turns, add small delay for readability
	if _engine.phase in ["monster_anim", "companion_anim"]:
		var delay := 0.3 if not _engine.auto_battle else 0.15
		await get_tree().create_timer(delay).timeout


# ── Result overlay ───────────────────────────────────────────────────

func _show_result_overlay(result: String) -> void:
	# Hide turn order so it doesn't show through
	var turn_row := get_node_or_null("HUD/TurnOrderRow")
	if turn_row:
		turn_row.visible = false

	# Ornate double-border panel
	var accent := ThemeManager.COLOR_GOLD_BRIGHT if result == "victory" else ThemeManager.COLOR_HP_RED
	if result == "flee":
		accent = ThemeManager.COLOR_TEXT_LIGHT
	var panel_style := ThemeManager.make_ornate_panel_style(accent)
	result_overlay.add_theme_stylebox_override("panel", panel_style)
	result_overlay.visible = true
	for c in result_vbox.get_children():
		c.queue_free()

	var stats: Dictionary = _engine.run.get("last_combat_stats", {})
	var monster_name: String = str(_engine.monster.get("name", "Monster"))

	# Pre-calc gold reward
	_gold_reward = 0
	if result == "victory":
		var r: Dictionary = _gs.dg_run
		var floor_num: int = int(r.get("floor", 1))
		var clears: int = _gs.dungeon_clears
		var gold_scale := 1.0 + float(clears) * 0.1
		_gold_reward = roundi((5.0 + randf() * 10.0) * float(floor_num) * gold_scale)
		if int(r.get("room", 0)) == 3:
			_gold_reward = roundi(float(_gold_reward) * 1.5)

	# Top decorative line
	result_vbox.add_child(ThemeManager.make_hrule(accent.darkened(0.3)))

	# Title
	var title := Label.new()
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])
	if _compact_font:
		title.add_theme_font_override("font", _compact_font)

	if result == "victory":
		title.text = "~ VICTORY ~"
		title.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
		result_vbox.add_child(title)
		_play_sfx_throttled(_sfx_victory_pool[randi() % _sfx_victory_pool.size()], 0.0)

		# Separator
		result_vbox.add_child(ThemeManager.make_separator(ThemeManager.COLOR_BORDER_GOLD))

		# Subtitle — monster slain + gold on same line
		var sub_lbl := Label.new()
		sub_lbl.text = monster_name + " slain!  +" + str(_gold_reward) + " Gold"
		sub_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		sub_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		sub_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
		if _compact_font:
			sub_lbl.add_theme_font_override("font", _compact_font)
		result_vbox.add_child(sub_lbl)

		# Compact stat line — centered, single row
		var dmg_dealt: int = int(stats.get("dmg_dealt", 0))
		var dmg_taken: int = int(stats.get("dmg_taken", 0))
		var turns: int = int(stats.get("turns", 0))
		var stat_lbl := Label.new()
		stat_lbl.text = str(dmg_dealt) + " dealt  /  " + str(dmg_taken) + " taken  /  " + str(turns) + " turns"
		stat_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		stat_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
		stat_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
		if _compact_font:
			stat_lbl.add_theme_font_override("font", _compact_font)
		result_vbox.add_child(stat_lbl)

	elif result == "defeat":
		title.text = "~ DEFEATED ~"
		title.add_theme_color_override("font_color", ThemeManager.COLOR_HP_RED)
		result_vbox.add_child(title)
		_play_sfx_throttled(_sfx_defeat_pool[randi() % _sfx_defeat_pool.size()], 0.0)

		result_vbox.add_child(ThemeManager.make_separator(ThemeManager.COLOR_HP_RED.darkened(0.3)))

		var sub_lbl := Label.new()
		sub_lbl.text = "Slain by " + monster_name
		sub_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		sub_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		sub_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_HP_RED.lightened(0.2))
		if _compact_font:
			sub_lbl.add_theme_font_override("font", _compact_font)
		result_vbox.add_child(sub_lbl)

		var dmg_dealt2: int = int(stats.get("dmg_dealt", 0))
		var dmg_taken2: int = int(stats.get("dmg_taken", 0))
		var turns2: int = int(stats.get("turns", 0))
		var stat_lbl := Label.new()
		stat_lbl.text = str(dmg_dealt2) + " dealt  /  " + str(dmg_taken2) + " taken  /  " + str(turns2) + " turns"
		stat_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		stat_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
		stat_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
		if _compact_font:
			stat_lbl.add_theme_font_override("font", _compact_font)
		result_vbox.add_child(stat_lbl)
	else:
		title.text = "~ ESCAPED ~"
		title.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
		result_vbox.add_child(title)

	# Flavor quote (skip for flee — no win/loss quote makes sense)
	if result != "flee":
		var quote_pool: Array[String] = COMBAT_WIN_QUOTES if result == "victory" else COMBAT_LOSS_QUOTES
		var quote_lbl := Label.new()
		quote_lbl.text = quote_pool[randi() % quote_pool.size()]
		quote_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		quote_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		quote_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		quote_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT.darkened(0.2))
		result_vbox.add_child(quote_lbl)

	# Bottom decorative line
	result_vbox.add_child(ThemeManager.make_hrule(accent.darkened(0.3)))

	# Spacer
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 3)
	result_vbox.add_child(spacer)

	var continue_btn := Button.new()
	continue_btn.text = ">> Continue"
	continue_btn.custom_minimum_size = Vector2(100, 20)
	continue_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	if _compact_font:
		continue_btn.add_theme_font_override("font", _compact_font)
	ThemeManager.style_button(continue_btn, accent)
	continue_btn.pressed.connect(_on_continue)
	result_vbox.add_child(continue_btn)


func _spawn_screen_flash(color: Color) -> void:
	var flash := ColorRect.new()
	flash.color = color
	flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(flash)
	var tw := create_tween()
	tw.tween_property(flash, "color:a", 0.0, 0.2)
	tw.tween_callback(flash.queue_free)


func _play_sfx_throttled(stream: AudioStream, min_gap: float = 0.15) -> void:
	var now := Time.get_ticks_msec() / 1000.0
	if now - _last_sfx_time >= min_gap:
		var sfx_mgr := get_node_or_null("/root/SfxManager")
		if sfx_mgr:
			sfx_mgr.play_sfx(stream)
		_last_sfx_time = now


func _on_continue() -> void:
	# Write back combat results to game state
	var r: Dictionary = _gs.dg_run
	r["hp"] = _engine.run.get("hp", 0)
	r["mana"] = _engine.run.get("mana", 0)
	r["potions"] = _engine.run.get("potions", 0)
	r["last_combat_stats"] = _engine.run.get("last_combat_stats", {})

	if _result == "victory":
		r["state"] = "combat_won"
		r["gold"] = int(r.get("gold", 0)) + _gold_reward
		r["total_dmg_dealt"] = int(r.get("total_dmg_dealt", 0)) + int(_engine.run.get("last_combat_stats", {}).get("dmg_dealt", 0))
		r["total_dmg_taken"] = int(r.get("total_dmg_taken", 0)) + int(_engine.run.get("last_combat_stats", {}).get("dmg_taken", 0))
	elif _result == "defeat":
		r["state"] = "dead"
		r["hp"] = 0
	else:
		r["state"] = "exploring"

	r["combat_enemy"] = {}
	_gs.dg_run = r

	if _gs._tutorial_return:
		_gs._tutorial_return = false
		TransitionManager.fade_to_scene("res://scenes/tutorial/tutorial.tscn")
	else:
		TransitionManager.fade_to_scene("res://scenes/dungeon/dungeon.tscn")
