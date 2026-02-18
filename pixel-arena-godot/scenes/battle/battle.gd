extends Node2D
## Real-time battle scene — renders CombatEngine state to Godot visuals.
## Maps logical coordinates (1000x500) to viewport (960x540).

const BattleVFXScript = preload("res://scripts/rendering/battle_vfx.gd")

@onready var entity_container: Node2D = $ArenaLayer/EntityContainer
@onready var projectile_container: Node2D = $ArenaLayer/ProjectileContainer
@onready var float_container: Node2D = $ArenaLayer/FloatTextContainer
@onready var hero1_hp_bar: ProgressBar = %Hero1HpBar
@onready var hero1_name: Label = %Hero1Name
@onready var hero2_hp_bar: ProgressBar = %Hero2HpBar
@onready var hero2_name: Label = %Hero2Name
@onready var hero1_resource: ProgressBar = %Hero1Resource
@onready var hero2_resource: ProgressBar = %Hero2Resource
@onready var hero1_buffs: HBoxContainer = %Hero1Buffs
@onready var hero2_buffs: HBoxContainer = %Hero2Buffs
@onready var hero1_stats_lbl: Label = %Hero1Stats
@onready var hero2_stats_lbl: Label = %Hero2Stats
@onready var combat_log: RichTextLabel = %CombatLog
@onready var speed1_btn: Button = %Speed1
@onready var speed2_btn: Button = %Speed2
@onready var speed3_btn: Button = %Speed3
@onready var log_btn: Button = %LogBtn
@onready var back_btn: Button = %BackBtn
@onready var victory_overlay: PanelContainer = %VictoryOverlay
@onready var victory_vbox: VBoxContainer = %VictoryVBox

var engine: CombatEngine
var _vfx: Node  # BattleVFX instance
var _compact_font: Font
var _log_visible: bool = false
var _status_particle_timer: float = 0.0
var _hero_factory: HeroFactory
var _gs: Node

# Visual entity nodes
var _h1_node: Node2D
var _h2_node: Node2D
var _follower_nodes: Dictionary = {}  # stable string key -> Node2D
var _projectile_nodes: Array[Node2D] = []

# Coordinate mapping
const SCALE_X: float = 960.0 / 1000.0
const SCALE_Y: float = 540.0 / 500.0

# Battle backgrounds
const BATTLE_BGS: Array[String] = [
	"res://assets/tilesets/battle_backgrounds/dark_forest.png",
	"res://assets/tilesets/battle_backgrounds/dungeon_depths.png",
	"res://assets/tilesets/battle_backgrounds/castle_throne.png",
	"res://assets/tilesets/battle_backgrounds/lava_cavern.png",
	"res://assets/tilesets/battle_backgrounds/frozen_wastes.png",
	"res://assets/tilesets/battle_backgrounds/graveyard.png",
	"res://assets/tilesets/battle_backgrounds/crystal_cave.png",
	"res://assets/tilesets/battle_backgrounds/demon_realm.png",
	"res://assets/tilesets/battle_backgrounds/ancient_ruins.png",
	"res://assets/tilesets/battle_backgrounds/ocean_abyss.png",
	"res://assets/tilesets/battle_backgrounds/sky_citadel.png",
	"res://assets/tilesets/battle_backgrounds/swamp_bog.png",
]

# Status particle configs: h[key] → {color, offset_y, dir_y, spread_x}
const STATUS_PARTICLES: Dictionary = {
	"burning": {"color": Color(1.0, 0.6, 0.15), "offset_y": -20, "dir_y": -15, "spread_x": 8},
	"poisoned": {"color": Color(0.4, 0.75, 0.25), "offset_y": 0, "dir_y": 12, "spread_x": 6},
	"bleeding": {"color": Color(0.8, 0.15, 0.15), "offset_y": 5, "dir_y": 10, "spread_x": 5},
	"slowed": {"color": Color(0.3, 0.7, 1.0), "offset_y": 20, "dir_y": -5, "spread_x": 10},
	"stunned": {"color": Color(1.0, 0.85, 0.2), "offset_y": -30, "dir_y": -3, "spread_x": 12},
	"shield_active": {"color": Color(0.3, 0.85, 0.85), "offset_y": 10, "dir_y": 3, "spread_x": 14},
	"shocked": {"color": Color(0.3, 0.8, 0.8), "offset_y": -15, "dir_y": -10, "spread_x": 10},
	"enraged": {"color": Color(1.0, 0.3, 0.1), "offset_y": -15, "dir_y": -10, "spread_x": 8},
	"vulnerable": {"color": Color(1.0, 0.4, 0.2), "offset_y": 0, "dir_y": 5, "spread_x": 8},
	"marked": {"color": Color(1.0, 0.65, 0.15), "offset_y": -25, "dir_y": -5, "spread_x": 10},
}


# Flavor quotes from Dio's contemporaries
const WIN_QUOTES: Array[String] = [
	"\"The strong take what they will, and the weak suffer what they must.\" — Vex, War Oracle",
	"\"Glory fades, but the scars? Those are forever.\" — Kael, Blade Mendicant",
	"\"You survived. That puts you ahead of ninety percent of applicants.\" — Mira, Guild Registrar",
	"\"Victory is just the intermission between catastrophes.\" — Orin, Doomsayer General",
	"\"I've seen gods fall to lesser foes. Don't let it go to your head.\" — Sable, Twilight Sage",
	"\"Another one bites the dust. Literally.\" — Ashara, Bone Whisperer",
]
const LOSS_QUOTES: Array[String] = [
	"\"Every champion's story ends the same. Yours just ended sooner.\" — Nyx, Void Shepherd",
	"\"Fall seven times, stand up eight. Or don't. I'm not your mother.\" — Mira, Guild Registrar",
	"\"The abyss sends its regards. And a bill for cleaning fees.\" — Ashara, Bone Whisperer",
	"\"Some are born great. Some achieve greatness. You died.\" — Vex, War Oracle",
	"\"I've written your epitaph. It's short.\" — Theron, Lorekeeper",
	"\"Defeat builds character. You must have great character by now.\" — Orin, Doomsayer General",
]

# Combat mode context
var _mode: String = "ladder"  # "ladder", "arena", "dungeon"
var _combat_result_callback: Callable
var _last_sfx_time: float = 0.0

# SFX preloads
var _sfx_hit: AudioStream = preload("res://assets/audio/sfx/woosh-1.wav")
var _sfx_crit: AudioStream = preload("res://assets/audio/sfx/woosh-2.wav")
var _sfx_victory: AudioStream = preload("res://assets/audio/sfx/victory-1.wav")
var _sfx_defeat: AudioStream = preload("res://assets/audio/sfx/monster-1.wav")
var _sfx_skill: AudioStream = preload("res://assets/audio/sfx/4.ogg")


func _ready() -> void:
	_gs = get_node("/root/GameState")
	_hero_factory = HeroFactory.new()
	add_child(_hero_factory)

	# Load compact font
	var tm := get_node_or_null("/root/ThemeManager")
	if tm:
		_compact_font = tm.pixel_font

	_vfx = BattleVFXScript.new()
	add_child(_vfx)

	engine = CombatEngine.new()
	add_child(engine)

	# Setup background
	_setup_background()

	# Connect HUD
	speed1_btn.pressed.connect(_set_speed.bind(1))
	speed2_btn.pressed.connect(_set_speed.bind(2))
	speed3_btn.pressed.connect(_set_speed.bind(3))
	log_btn.pressed.connect(_toggle_combat_log)
	back_btn.pressed.connect(_on_back)

	# Connect engine signals
	engine.combat_ended.connect(_on_combat_ended)
	engine.float_spawned.connect(_on_float_spawned)
	engine.log_added.connect(_on_log)
	engine.damage_dealt.connect(_on_damage_dealt)
	engine.spell_cast.connect(_on_spell_cast)
	engine.melee_attack.connect(_on_melee_attack)
	engine.ranged_attack.connect(_on_ranged_attack)

	# Determine mode and setup combatants
	if _gs.has_active_run() and not _gs.dg_run.get("combat_enemy", {}).is_empty():
		_mode = "dungeon"
		_setup_dungeon_combat()
	elif _gs._ladder_mode:
		_mode = "ladder"
		_setup_ladder_combat()
	elif not _gs._arena_opponent_build.is_empty():
		_mode = "arena"
		_setup_arena_combat()
	else:
		_mode = "arena"
		_setup_arena_combat()


func _setup_background() -> void:
	# Remove any legacy Background ColorRect (Control nodes render on top of Node2D siblings)
	var old_bg := get_node_or_null("Background")
	if old_bg:
		remove_child(old_bg)
		old_bg.queue_free()
	var bg_path: String = BATTLE_BGS[randi() % BATTLE_BGS.size()]
	var tex: Texture2D = load(bg_path) as Texture2D
	if tex:
		var bg_sprite := Sprite2D.new()
		bg_sprite.name = "BattleBg"
		bg_sprite.texture = tex
		bg_sprite.centered = false
		var tex_size: Vector2 = tex.get_size()
		if tex_size.x > 0 and tex_size.y > 0:
			bg_sprite.scale = Vector2(960.0 / tex_size.x, 540.0 / tex_size.y)
		bg_sprite.modulate = Color(0.35, 0.30, 0.40, 1.0)
		bg_sprite.z_index = -10
		add_child(bg_sprite)
		move_child(bg_sprite, 0)


# ============ COMBAT SETUP ============

func _setup_dungeon_combat() -> void:
	var r: Dictionary = _gs.dg_run
	var h1: Dictionary = _hero_factory.mk_dungeon_hero(r, "left")
	var m: Dictionary = r.get("combat_enemy", {})
	var h2: Dictionary = _hero_factory.mk_dungeon_monster(m, "right")

	# Apply deployed follower buff to hero
	var deployed: Dictionary = r.get("deployed_follower", {})
	if not deployed.is_empty():
		var tmpl := _hero_factory._find_follower_template(deployed.get("template_name", deployed.get("name", "")))
		if not tmpl.is_empty():
			_hero_factory.apply_follower_buff(h1, tmpl)

	_start_battle(h1, h2)

	# Spawn deployed follower as combat companion
	h1["arena_followers"] = []
	if not deployed.is_empty():
		var tmpl := _hero_factory._find_follower_template(deployed.get("template_name", deployed.get("name", "")))
		if tmpl.is_empty():
			tmpl = deployed
		var af := _hero_factory.mk_arena_follower(tmpl, h1, 0, 1)
		h1["arena_followers"].append(af)


func _setup_ladder_combat() -> void:
	# Ladder sets _ladder_opponent on GameState before changing scene
	var opponent_cfg: Dictionary = _gs._ladder_opponent
	var class_key: String = opponent_cfg.get("class_key", "")

	var h1 := _hero_factory.mk_custom_hero("left")

	var h2: Dictionary
	if opponent_cfg.get("is_generated", false):
		h2 = _hero_factory.mk_ladder_hero(opponent_cfg, "right")
	elif not class_key.is_empty():
		# First 4 ladder fights are class NPCs at 0.7x
		h2 = _hero_factory.mk_hero(class_key, "right", 0.7)
	else:
		h2 = _hero_factory.mk_hero("barbarian", "right", 0.7)

	# Apply companion buff to player (NO debuff on opponent — nothing is wagered)
	var run: Dictionary = _gs.ladder_run
	var comp_idx: int = int(run.get("companion", -1))
	if comp_idx >= 0 and comp_idx < _gs.followers.size():
		var comp_f: Dictionary = _gs.followers[comp_idx]
		var tmpl := _hero_factory._find_follower_template(comp_f.get("template_name", comp_f.get("name", "")))
		if not tmpl.is_empty():
			_hero_factory.apply_follower_buff(h1, tmpl)

	_start_battle(h1, h2)

	# Spawn companion as single arena follower
	h1["arena_followers"] = []
	if comp_idx >= 0 and comp_idx < _gs.followers.size():
		var f_data: Dictionary = _gs.followers[comp_idx]
		var tmpl := _hero_factory._find_follower_template(f_data.get("template_name", f_data.get("name", "")))
		if tmpl.is_empty():
			tmpl = f_data
		var af := _hero_factory.mk_arena_follower(tmpl, h1, 0, 1)
		h1["arena_followers"].append(af)


func _setup_arena_combat() -> void:
	var opponent_build: Dictionary = _gs._arena_opponent_build
	var h1 := _hero_factory.mk_custom_hero("left")
	var h2: Dictionary
	if not opponent_build.is_empty():
		h2 = _hero_factory.mk_arena_hero(opponent_build, "right")
	else:
		h2 = _hero_factory.mk_hero("barbarian", "right")

	# Apply wager buff to player + debuff to opponent
	var staked_idx: int = int(_gs._arena_staked.get("index", -1))
	if staked_idx >= 0 and staked_idx < _gs.followers.size():
		var staked_f: Dictionary = _gs.followers[staked_idx]
		var tmpl := _hero_factory._find_follower_template(staked_f.get("template_name", staked_f.get("name", "")))
		if not tmpl.is_empty():
			_hero_factory.apply_follower_buff(h1, tmpl)
			_hero_factory.apply_wager_debuff(h2, tmpl)

	_start_battle(h1, h2)

	# Spawn fighter followers
	var fighters: Array = _gs._arena_fighters
	h1["arena_followers"] = []
	for i in range(fighters.size()):
		var fi: int = int(fighters[i])
		if fi >= 0 and fi < _gs.followers.size():
			var f_data: Dictionary = _gs.followers[fi]
			var tmpl := _hero_factory._find_follower_template(f_data.get("template_name", f_data.get("name", "")))
			if tmpl.is_empty():
				tmpl = f_data
			var af := _hero_factory.mk_arena_follower(tmpl, h1, i, fighters.size())
			h1["arena_followers"].append(af)


func _start_battle(h1: Dictionary, h2: Dictionary) -> void:
	engine.setup(h1, h2)

	# Create visual entities
	_h1_node = _create_entity_node(h1)
	_h2_node = _create_entity_node(h2)
	entity_container.add_child(_h1_node)
	entity_container.add_child(_h2_node)

	# HUD — explicit font override for pixel-crisp rendering
	hero1_name.text = str(h1.get("name", "Hero 1"))
	hero2_name.text = str(h2.get("name", "Hero 2"))
	if _compact_font:
		hero1_name.add_theme_font_override("font", _compact_font)
		hero2_name.add_theme_font_override("font", _compact_font)
	hero1_name.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	hero2_name.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	hero1_name.clip_text = true
	hero2_name.clip_text = true

	# HP number overlays on bars (using compact font)
	for bar in [hero1_hp_bar, hero2_hp_bar]:
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

	# Style HP bars — bevel + gold border + frame overlay
	_style_hp_bar(hero1_hp_bar, ThemeManager.COLOR_HP_GREEN)
	_style_hp_bar(hero2_hp_bar, ThemeManager.COLOR_HP_RED)

	# Resource bar number overlays (using compact font)
	for bar in [hero1_resource, hero2_resource]:
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
		bar.add_child(res_lbl)

	# Style resource bars per class
	_style_resource_bar(hero1_resource, h1)
	_style_resource_bar(hero2_resource, h2)

	# Stat row labels (compact font)
	if _compact_font:
		hero1_stats_lbl.add_theme_font_override("font", _compact_font)
		hero2_stats_lbl.add_theme_font_override("font", _compact_font)
	hero1_stats_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	hero1_stats_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
	hero2_stats_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	hero2_stats_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)

	_style_battle_hud()
	engine.start()


func _style_battle_hud() -> void:
	# Dark strip behind top bar area (HP bars + names + stat row)
	var top_bg := ColorRect.new()
	top_bg.color = Color(0.06, 0.06, 0.10, 0.75)
	top_bg.position = Vector2(0, 0)
	top_bg.size = Vector2(960, 81)
	top_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	$HUD.add_child(top_bg)
	$HUD.move_child(top_bg, 0)

	# Dark strip behind bottom controls
	var bot_bg := ColorRect.new()
	bot_bg.color = Color(0.06, 0.06, 0.10, 0.75)
	bot_bg.position = Vector2(0, 504)
	bot_bg.size = Vector2(960, 36)
	bot_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	$HUD.add_child(bot_bg)
	$HUD.move_child(bot_bg, 1)

	# Style combat log (overlay panel)
	var log_style := ThemeManager.make_inset_style(0.95)
	log_style.set_content_margin_all(4)
	combat_log.add_theme_stylebox_override("normal", log_style)
	if _compact_font:
		combat_log.add_theme_font_override("normal_font", _compact_font)
	combat_log.add_theme_font_size_override("normal_font_size", ThemeManager.FONT_SIZES["body"])

	# Style all HUD buttons with ThemeManager
	for btn in [speed1_btn, speed2_btn, speed3_btn, log_btn]:
		btn.custom_minimum_size = Vector2(32, 20)
		ThemeManager.style_button(btn)
		if _compact_font:
			btn.add_theme_font_override("font", _compact_font)
		btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	back_btn.custom_minimum_size = Vector2(40, 20)
	ThemeManager.style_button(back_btn, ThemeManager.COLOR_HP_RED.darkened(0.2))
	if _compact_font:
		back_btn.add_theme_font_override("font", _compact_font)
	back_btn.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])


# ============ ENTITY CREATION ============

func _create_entity_node(h: Dictionary) -> Node2D:
	var node := Node2D.new()
	node.name = str(h.get("name", "Entity"))

	# Use LayeredSprite for all entities
	var ls := LayeredSprite.new()
	ls.name = "LayeredSprite"

	var class_key: String = str(h.get("class_key", h.get("custom_sprite", h.get("type", ""))))
	var is_monster := h.has("monster_icon") or h.has("monster_type")

	if is_monster:
		var monster_name: String = str(h.get("name", ""))
		ls.set_monster(monster_name)
	elif not class_key.is_empty() and class_key != "custom":
		ls.set_class(class_key)
	else:
		ls.set_class("barbarian")

	if h.get("side", "left") == "right":
		ls.set_flipped(true)

	ls.start_idle_bob(1.0, 1.5 + randf() * 0.5)
	node.set_meta("base_sprite_scale", Vector2.ONE)
	node.add_child(ls)

	# HP bar above sprite
	var hp_bg := ColorRect.new()
	hp_bg.name = "HpBg"
	hp_bg.size = Vector2(32, 4)
	hp_bg.position = Vector2(-16, -36)
	hp_bg.color = Color(0.10, 0.10, 0.18, 0.8)
	node.add_child(hp_bg)

	var hp_fill := ColorRect.new()
	hp_fill.name = "HpFill"
	hp_fill.size = Vector2(32, 4)
	hp_fill.position = Vector2(-16, -36)
	hp_fill.color = ThemeManager.COLOR_HP_GREEN if h.get("side", "left") == "left" else ThemeManager.COLOR_HP_RED
	node.add_child(hp_fill)

	return node




# ============ COORDINATE MAPPING ============

func _logical_to_screen(lx: float, ly: float) -> Vector2:
	return Vector2(lx * SCALE_X, ly * SCALE_Y)


# ============ FRAME UPDATE ============

func _process(delta: float) -> void:
	if engine.over:
		return
	_update_entity(_h1_node, engine.h1, delta)
	_update_entity(_h2_node, engine.h2, delta)
	_update_followers(delta)
	_update_projectiles(delta)
	_update_hud()
	_y_sort_entities()
	# Status particles
	_status_particle_timer += delta
	if _status_particle_timer >= 0.4:
		_status_particle_timer = 0.0
		_spawn_entity_status_particles(_h1_node, engine.h1)
		_spawn_entity_status_particles(_h2_node, engine.h2)


func _update_entity(node: Node2D, h: Dictionary, _delta: float) -> void:
	if node == null or h.is_empty():
		return
	# Position
	var screen_pos := _logical_to_screen(float(h.get("x", 0)), float(h.get("y", CombatConstants.GY)))
	# Clamp entities to their half of the screen to prevent overlap
	if h.get("side", "left") == "left":
		screen_pos.x = minf(screen_pos.x, 170.0)
	else:
		screen_pos.x = maxf(screen_pos.x, 214.0)
	node.position = screen_pos

	# Bob animation
	var bob: float = sin(float(h.get("bob_phase", 0))) * 2.0

	# Update LayeredSprite (or legacy Sprite2D fallback)
	var ls: LayeredSprite = node.get_node_or_null("LayeredSprite")
	var visual_node: Node2D = ls if ls else node.get_node_or_null("Sprite")
	if visual_node:
		# Stealth alpha
		if h.get("stealthed", false):
			visual_node.modulate.a = 0.35
		else:
			visual_node.modulate.a = 1.0
		# Hurt flash
		if float(h.get("hurt_anim", 0)) > 0:
			visual_node.modulate = Color(1.0, 0.4, 0.4, visual_node.modulate.a)
		elif h.get("ult_active", false):
			visual_node.modulate = Color(1.0, 0.9, 0.5, visual_node.modulate.a)
		else:
			visual_node.modulate = Color(1.0, 1.0, 1.0, visual_node.modulate.a)

	# HP bar
	var hp_fill: ColorRect = node.get_node_or_null("HpFill")
	if hp_fill:
		var hp_pct := clampf(float(h.get("hp", 0)) / maxf(1.0, float(h.get("max_hp", 1))), 0.0, 1.0)
		hp_fill.size.x = 32.0 * hp_pct

	# Shield indicator
	var hp_bg: ColorRect = node.get_node_or_null("HpBg")
	if hp_bg:
		if h.get("shield_active", false):
			hp_bg.color = Color(ThemeManager.COLOR_MANA_BLUE.r, ThemeManager.COLOR_MANA_BLUE.g, ThemeManager.COLOR_MANA_BLUE.b, 0.8)
		else:
			hp_bg.color = Color(0.10, 0.10, 0.18, 0.8)


func _update_followers(_delta: float) -> void:
	for h in [engine.h1, engine.h2]:
		var side: String = str(h.get("side", "left"))
		# Ranger follower — use stable string key instead of mutable dict
		if h.get("follower_alive", false):
			var f: Dictionary = h.get("follower", {})
			if not f.is_empty():
				var fkey: String = side + "_ranger_follower"
				var fnode: Node2D = _follower_nodes.get(fkey, null)
				if fnode == null:
					fnode = _create_follower_node(f, side)
					_follower_nodes[fkey] = fnode
					entity_container.add_child(fnode)
				fnode.position = _logical_to_screen(float(f.get("x", 0)), float(f.get("y", CombatConstants.GY)))
				fnode.visible = true
		elif h.has("follower"):
			var fkey: String = side + "_ranger_follower"
			var fnode: Node2D = _follower_nodes.get(fkey, null)
			if fnode:
				fnode.visible = false

		# Arena followers — use stable string key (side + index)
		var afs: Array = h.get("arena_followers", [])
		for i in range(afs.size()):
			var af: Dictionary = afs[i]
			var afkey: String = side + "_arena_" + str(i)
			var afnode: Node2D = _follower_nodes.get(afkey, null)
			if afnode == null:
				afnode = _create_follower_node(af, af.get("owner_side", side))
				_follower_nodes[afkey] = afnode
				entity_container.add_child(afnode)
			if af.get("alive", false):
				afnode.position = _logical_to_screen(float(af.get("x", 0)), float(af.get("y", CombatConstants.GY)))
				afnode.visible = true
				# HP bar
				var hp_fill: ColorRect = afnode.get_node_or_null("HpFill")
				if hp_fill:
					var hp_pct := clampf(float(af.get("hp", 0)) / maxf(1.0, float(af.get("max_hp", 1))), 0.0, 1.0)
					hp_fill.size.x = 16.0 * hp_pct
				# Hurt flash
				var dot: ColorRect = afnode.get_node_or_null("Dot")
				if dot and float(af.get("hurt_anim", 0)) > 0:
					dot.color = Color(1.0, 0.4, 0.4)
				elif dot:
					dot.color = Color.from_string(str(af.get("color", "#aaa")), Color.GRAY)
			else:
				afnode.visible = false


func _create_follower_node(f: Dictionary, side: String) -> Node2D:
	var node := Node2D.new()
	# Try to load generated follower sprite
	var f_name: String = str(f.get("template_name", f.get("name", "")))
	var ls := LayeredSprite.new()
	ls.name = "FollowerSprite"
	ls.set_follower(f_name)
	ls.scale = Vector2(0.5, 0.5)
	if side == "right":
		ls.set_flipped(true)
	# Flying/floating followers get a bob animation
	var height_type: String = str(f.get("height_type", "ground"))
	if height_type == "fly":
		ls.start_idle_bob(2.0, 1.2 + randf() * 0.3)
	elif height_type == "float":
		ls.start_idle_bob(1.2, 1.8 + randf() * 0.4)
	node.add_child(ls)
	# Small HP bar
	var hp_bg := ColorRect.new()
	hp_bg.name = "HpBg"
	hp_bg.size = Vector2(16, 2)
	hp_bg.position = Vector2(-8, -8)
	hp_bg.color = Color(0.10, 0.10, 0.18, 0.7)
	node.add_child(hp_bg)
	var hp_fill := ColorRect.new()
	hp_fill.name = "HpFill"
	hp_fill.size = Vector2(16, 2)
	hp_fill.position = Vector2(-8, -8)
	hp_fill.color = ThemeManager.COLOR_HP_GREEN if side == "left" else ThemeManager.COLOR_HP_RED
	node.add_child(hp_fill)
	return node


func _update_projectiles(_delta: float) -> void:
	# Clean up finished projectiles
	for i in range(_projectile_nodes.size() - 1, -1, -1):
		var pn: Node2D = _projectile_nodes[i]
		if not is_instance_valid(pn) or not pn.visible:
			if is_instance_valid(pn):
				pn.queue_free()
			_projectile_nodes.remove_at(i)

	# Render engine projectiles
	for proj in engine.projectiles:
		if not proj.has("_node"):
			var w_type: String = str(proj.get("type", "bow"))
			var col: String = str(proj.get("color", "#fff"))
			var wrapper: Node2D = _vfx.create_projectile_node(w_type, col)
			projectile_container.add_child(wrapper)
			proj["_node"] = wrapper
			_projectile_nodes.append(wrapper)
		var pnode: Node2D = proj.get("_node")
		if pnode and is_instance_valid(pnode):
			var new_pos := _logical_to_screen(float(proj.get("x", 0)), float(proj.get("y", 0)))
			# Rotate projectile toward movement direction
			var old_pos := pnode.position
			if old_pos.distance_to(new_pos) > 0.5:
				pnode.rotation = (new_pos - old_pos).angle()
			pnode.position = new_pos


func _y_sort_entities() -> void:
	var children := entity_container.get_children()
	children.sort_custom(func(a: Node2D, b: Node2D) -> bool: return a.position.y < b.position.y)
	for i in range(children.size()):
		entity_container.move_child(children[i], i)


func _update_hud() -> void:
	hero1_hp_bar.max_value = float(engine.h1.get("max_hp", 1))
	hero1_hp_bar.value = maxf(0, float(engine.h1.get("hp", 0)))
	hero2_hp_bar.max_value = float(engine.h2.get("max_hp", 1))
	hero2_hp_bar.value = maxf(0, float(engine.h2.get("hp", 0)))

	# HP number overlays
	var h1_hp := maxi(0, roundi(float(engine.h1.get("hp", 0))))
	var h1_max := maxi(1, roundi(float(engine.h1.get("max_hp", 1))))
	var h1_text: Label = hero1_hp_bar.get_node_or_null("HpText")
	if h1_text:
		h1_text.text = str(h1_hp) + "/" + str(h1_max)
	var h2_hp := maxi(0, roundi(float(engine.h2.get("hp", 0))))
	var h2_max := maxi(1, roundi(float(engine.h2.get("max_hp", 1))))
	var h2_text: Label = hero2_hp_bar.get_node_or_null("HpText")
	if h2_text:
		h2_text.text = str(h2_hp) + "/" + str(h2_max)

	# Resource bars
	_update_resource_bar(hero1_resource, engine.h1)
	_update_resource_bar(hero2_resource, engine.h2)

	# Stat row
	hero1_stats_lbl.text = _format_stats(engine.h1)
	hero2_stats_lbl.text = _format_stats(engine.h2)

	# Buff badges
	_update_buffs(engine.h1, hero1_buffs)
	_update_buffs(engine.h2, hero2_buffs)


func _toggle_combat_log() -> void:
	_log_visible = not _log_visible
	combat_log.visible = _log_visible
	if _log_visible:
		log_btn.text = "[Log]"
		log_btn.add_theme_color_override("font_color", ThemeManager.COLOR_SUCCESS_GREEN)
	else:
		log_btn.text = "Log"
		log_btn.remove_theme_color_override("font_color")


func _format_stats(h: Dictionary) -> String:
	var dmg := roundi(float(h.get("base_dmg", 0)))
	var def := roundi(float(h.get("def", 0)))
	var spd := snappedf(float(h.get("base_as", h.get("as", 1.0))), 0.01)
	var eva := roundi(float(h.get("evasion", 0.0)) * 100.0)
	return "DMG:" + str(dmg) + " DEF:" + str(def) + " AS:" + str(spd) + " EVA:" + str(eva) + "%"


func _style_hp_bar(bar: ProgressBar, fill_color: Color) -> void:
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
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.05, 0.05, 0.10)
	bg.border_color = ThemeManager.COLOR_BORDER_GOLD
	bg.set_border_width_all(1)
	bg.set_corner_radius_all(0)
	bg.set_content_margin_all(0)
	bar.add_theme_stylebox_override("background", bg)
	# Frame overlay
	var frame_tex = load("res://assets/sprites/generated/vfx/vfx_hp_frame.png")
	if frame_tex:
		var frame := TextureRect.new()
		frame.name = "FrameOverlay"
		frame.texture = frame_tex
		frame.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		frame.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		frame.stretch_mode = TextureRect.STRETCH_SCALE
		frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
		bar.add_child(frame)


func _style_resource_bar(bar: ProgressBar, h: Dictionary) -> void:
	var fill := StyleBoxFlat.new()
	fill.set_corner_radius_all(0)
	var hero_type: String = str(h.get("type", h.get("class_key", "")))
	match hero_type:
		"wizard":
			fill.bg_color = Color(0.2, 0.5, 0.9)  # cyan-blue mana
		"assassin":
			fill.bg_color = Color(0.9, 0.8, 0.2)  # yellow energy
		"ranger":
			fill.bg_color = Color(0.9, 0.55, 0.15)  # orange focus
		_:
			fill.bg_color = Color(0.7, 0.2, 0.2)  # red rage
	bar.add_theme_stylebox_override("fill", fill)


func _update_resource_bar(bar: ProgressBar, h: Dictionary) -> void:
	var cur_val: float = 0.0
	var max_val: float = 0.0
	var has_resource := false

	# Check for mana, energy, or rage
	if float(h.get("max_mana", 0)) > 0:
		max_val = float(h.get("max_mana", 1))
		cur_val = maxf(0, float(h.get("mana", 0)))
		has_resource = true
	elif float(h.get("max_energy", 0)) > 0:
		max_val = float(h.get("max_energy", 1))
		cur_val = maxf(0, float(h.get("energy", 0)))
		has_resource = true
	elif float(h.get("rage", 0)) > 0 or float(h.get("max_rage", 0)) > 0:
		max_val = maxf(1.0, float(h.get("max_rage", 100)))
		cur_val = maxf(0, float(h.get("rage", 0)))
		has_resource = true

	if has_resource:
		bar.max_value = max_val
		bar.value = cur_val
		bar.visible = true
		# Update number overlay
		var res_text: Label = bar.get_node_or_null("ResText")
		if res_text:
			res_text.text = str(roundi(cur_val)) + "/" + str(roundi(max_val))
	else:
		bar.visible = false


const BUFF_DEFS: Array = [
	["shield_active", "SHD", Color(0.3, 0.7, 0.9)],
	["stealthed", "STL", Color(0.5, 0.5, 0.7)],
	["ult_active", "ULT", Color(1.0, 0.85, 0.3)],
	["stunned", "STN", Color(0.9, 0.8, 0.2)],
	["burning", "BRN", Color(0.9, 0.4, 0.1)],
	["poisoned", "PSN", Color(0.3, 0.8, 0.3)],
	["bleeding", "BLD", Color(0.7, 0.2, 0.15)],
	["shocked", "SHK", Color(0.3, 0.8, 0.8)],
	["slowed", "SLW", Color(0.4, 0.4, 0.7)],
	["vulnerable", "VLN", Color(0.9, 0.3, 0.3)],
	["enraged", "RGE", Color(0.9, 0.2, 0.1)],
	["marked", "MRK", Color(0.9, 0.5, 0.2)],
	["riposte_active", "RPT", Color(0.6, 0.6, 0.9)],
	["thorns_active", "THN", Color(0.3, 0.7, 0.3)],
	["bloodlust_active", "BLS", Color(0.8, 0.2, 0.3)],
	["smoke_active", "SMK", Color(0.5, 0.5, 0.5)],
]


func _update_buffs(h: Dictionary, container: HBoxContainer) -> void:
	# Pool approach: reuse existing labels, hide extras
	var idx := 0
	for buff_def in BUFF_DEFS:
		var key: String = buff_def[0]
		var show := false
		if h.has(key):
			var val = h[key]
			if val is bool:
				show = val
			elif val is float:
				show = val > 0
			elif val is int:
				show = val > 0
		if show:
			var lbl: Label
			if idx < container.get_child_count():
				lbl = container.get_child(idx) as Label
			else:
				lbl = Label.new()
				if _compact_font:
					lbl.add_theme_font_override("font", _compact_font)
				lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
				container.add_child(lbl)
			lbl.text = buff_def[1]
			lbl.add_theme_color_override("font_color", buff_def[2])
			lbl.visible = true
			idx += 1

	# Hide unused labels
	for i in range(idx, container.get_child_count()):
		container.get_child(i).visible = false


# ============ SIGNALS ============

func _on_float_spawned(x: float, y: float, text: String, color: String) -> void:
	# Infer category from text/color for styling
	var category := "normal"
	if text.begins_with("+"):
		category = "heal"
	elif text == "MISS" or text == "RESIST":
		category = "miss"
	elif text.begins_with("CRIT"):
		category = "crit"
	elif text.begins_with("Shield") or text.begins_with("RIPOSTE") or text.begins_with("THORNS") \
		or text == "BERSERKER" or text.contains("DEATH MARK"):
		category = "info"
	elif text.begins_with("ZAP"):
		category = "dot"
	elif text.begins_with("BOOM") or text.begins_with("DEATH "):
		category = "big"
	elif text.begins_with("-"):
		# Check magnitude for big hits
		var num_str := text.replace("-", "").replace(",", "")
		if num_str.is_valid_int() and num_str.to_int() > 200:
			category = "big"

	var label := Label.new()
	label.text = text
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

	# Category-based font size
	var font_size: int
	match category:
		"crit": font_size = 20
		"big": font_size = 18
		"dot", "miss": font_size = 14
		"info": font_size = 14
		_: font_size = 16

	# Category-based color override
	var font_color := Color.from_string(color, Color.WHITE)
	match category:
		"crit": font_color = Color.from_string("#ffda66", Color.GOLD)
		"heal": font_color = Color.from_string("#4a8a4a", Color.GREEN)
		"miss": font_color = Color.from_string("#888888", Color.GRAY)

	# LabelSettings for crisp outlines
	var ls := LabelSettings.new()
	if _compact_font:
		ls.font = _compact_font
	ls.font_size = font_size
	ls.font_color = font_color
	ls.outline_size = 1
	ls.outline_color = Color(0, 0, 0, 0.9)
	ls.shadow_size = 1
	ls.shadow_color = Color(0, 0, 0, 0.5)
	ls.shadow_offset = Vector2(1, 1)
	label.label_settings = ls

	label.position = _logical_to_screen(x, y)
	float_container.add_child(label)

	# Category-based animation
	var drift: float
	var duration: float
	match category:
		"crit":
			drift = -25.0
			duration = 1.0
		"big":
			drift = -20.0
			duration = 0.9
		"dot":
			drift = -10.0
			duration = 0.6
		"miss":
			drift = -12.0
			duration = 0.5
		_:
			drift = -15.0
			duration = 0.8

	var tween := create_tween()
	if category == "crit" or category == "big":
		# Pop scale animation: start small, pop up, settle, then drift + fade
		label.scale = Vector2(0.3, 0.3)
		label.pivot_offset = Vector2(label.size.x / 2, label.size.y / 2)
		tween.tween_property(label, "scale", Vector2(1.3, 1.3), 0.1)
		tween.tween_property(label, "scale", Vector2(1.0, 1.0), 0.1)
		tween.tween_property(label, "position:y", label.position.y + drift, duration - 0.5)
		tween.tween_property(label, "modulate:a", 0.0, 0.3)
	else:
		tween.tween_property(label, "position:y", label.position.y + drift, duration)
		tween.parallel().tween_property(label, "modulate:a", 0.0, duration)
	tween.tween_callback(label.queue_free)


func _on_log(time_sec: float, text: String, log_type: String) -> void:
	var color := "#e8d4a8"
	match log_type:
		"combat": color = "#ffda66"
		"buff": color = "#4ecdc4"
		"debuff": color = "#ff8844"
		"heal": color = "#4a8a4a"
		"bad": color = "#c04040"
		"warning": color = "#ffda66"
		"dot": color = "#aa6644"
		"ult": color = "#dd88ff"
		"info": color = "#9a8a6a"
	combat_log.append_text("[color=#8a7a50]" + str(snappedf(time_sec, 0.1)) + "s[/color] [color=" + color + "]" + text + "[/color]\n")


# ============ COMBAT VFX ============

const SPELL_TEXTURES: Dictionary = {
	"lightning": "res://assets/sprites/generated/vfx/vfx_arcane_bolt.png",
	"chain_lightning": "res://assets/sprites/generated/vfx/vfx_arcane_bolt.png",
	"fireball": "res://assets/sprites/generated/vfx/vfx_fireball.png",
	"fire": "res://assets/sprites/generated/vfx/vfx_firebomb.png",
	"ice": "res://assets/sprites/generated/vfx/vfx_ice_lance.png",
	"frost": "res://assets/sprites/generated/vfx/vfx_ice_lance.png",
	"shadow": "res://assets/sprites/generated/vfx/vfx_darkness_bolt.png",
	"dark": "res://assets/sprites/generated/vfx/vfx_darkness_orb.png",
	"arcane": "res://assets/sprites/generated/vfx/vfx_magic_orb.png",
	"heal": "res://assets/sprites/generated/vfx/vfx_light_bolt.png",
	"shield": "res://assets/sprites/generated/vfx/vfx_shield.png",
	"water": "res://assets/sprites/generated/vfx/vfx_water_bolt.png",
	"wind": "res://assets/sprites/generated/vfx/vfx_wind_bolt.png",
	"nature": "res://assets/sprites/generated/vfx/vfx_plant_missile.png",
}


func _on_damage_dealt(attacker: Dictionary, target: Dictionary, amount: float, info: Dictionary = {}) -> void:
	if amount < 1.0:
		return
	var tx: float = float(target.get("x", 0))
	var ty: float = float(target.get("y", CombatConstants.GY)) - 20
	var screen_pos := _logical_to_screen(tx, ty)
	var weapon_type: String = info.get("weapon_type", str(attacker.get("weapon_visual_type", "sword")))
	var is_crit: bool = info.get("is_crit", false)
	_vfx.spawn_hit_impact(weapon_type, screen_pos, amount, is_crit, float_container)
	_play_sfx_throttled(_sfx_hit)
	# Screen shake on big hits or crits
	if is_crit or amount > 200:
		_screen_shake(minf(amount / 150.0, 4.0), 0.15)


func _on_spell_cast(caster: Dictionary, spell_name: String) -> void:
	var cx: float = float(caster.get("x", 0))
	var cy: float = float(caster.get("y", CombatConstants.GY)) - 25
	var screen_pos := _logical_to_screen(cx, cy)
	_spawn_spell_flash(screen_pos, spell_name)
	_play_sfx_throttled(_sfx_skill, 0.3)


func _on_melee_attack(attacker: Dictionary, target: Dictionary, weapon_type: String) -> void:
	# Play melee lunge animation on attacker sprite
	var atk_node: Node2D = _h1_node if attacker.get("side", "") == "left" else _h2_node
	if atk_node:
		var ls: LayeredSprite = atk_node.get_node_or_null("LayeredSprite")
		if ls:
			var tx: float = float(target.get("x", 0))
			var toward_screen_x := tx * SCALE_X
			ls.play_attack(toward_screen_x, 0.2)
	# Spawn melee slash VFX at target position
	var tgt_x := float(target.get("x", 0))
	var tgt_y := float(target.get("y", CombatConstants.GY)) - 20
	var screen_pos := _logical_to_screen(tgt_x, tgt_y)
	var dir := 1.0 if float(attacker.get("x", 0)) < tgt_x else -1.0
	_vfx.spawn_melee_vfx(weapon_type, screen_pos, dir, float_container)


func _on_ranged_attack(attacker: Dictionary, _weapon_type: String) -> void:
	# Play cast/lean-back animation on attacker sprite
	var atk_node: Node2D = _h1_node if attacker.get("side", "") == "left" else _h2_node
	if atk_node:
		var ls: LayeredSprite = atk_node.get_node_or_null("LayeredSprite")
		if ls:
			ls.play_cast(0.15)



func _spawn_spell_flash(pos: Vector2, spell_name: String) -> void:
	var tex_path: String = ""
	var name_lower := spell_name.to_lower()
	for keyword in SPELL_TEXTURES:
		if keyword in name_lower:
			tex_path = SPELL_TEXTURES[keyword]
			break
	if tex_path.is_empty():
		tex_path = "res://assets/sprites/generated/vfx/vfx_magic_sparks.png"

	var tex = load(tex_path)
	if not tex:
		return
	var sprite := Sprite2D.new()
	sprite.texture = tex
	sprite.position = pos + Vector2(0, -5)
	sprite.scale = Vector2(0.15, 0.15)
	sprite.modulate.a = 0.85
	float_container.add_child(sprite)
	var tween := create_tween()
	tween.tween_property(sprite, "scale", Vector2(0.3, 0.3), 0.25)
	tween.parallel().tween_property(sprite, "modulate:a", 0.0, 0.35)
	tween.tween_callback(sprite.queue_free)


func _on_combat_ended(winner: Dictionary) -> void:
	var player_won: bool = winner.get("side", "") == "left"
	# Death animation on loser
	var loser_node: Node2D = _h2_node if player_won else _h1_node
	if loser_node:
		var ls: LayeredSprite = loser_node.get_node_or_null("LayeredSprite")
		if ls:
			ls.play_death(0.5)
		_vfx.spawn_death_effect(loser_node.position, float_container)
		_screen_shake(3.0, 0.3)
	_show_victory_overlay(player_won)
	if _mode == "dungeon":
		_handle_dungeon_result(player_won)
	elif _mode == "ladder":
		_handle_ladder_result(player_won)
	else:
		_handle_arena_result(player_won)


func _show_victory_overlay(player_won: bool) -> void:
	# Ornate double-border panel
	var accent := ThemeManager.COLOR_GOLD_BRIGHT if player_won else ThemeManager.COLOR_HP_RED
	var panel_style := ThemeManager.make_ornate_panel_style(accent)
	victory_overlay.add_theme_stylebox_override("panel", panel_style)

	for child in victory_vbox.get_children():
		child.queue_free()

	# Top decorative line
	victory_vbox.add_child(ThemeManager.make_hrule(accent.darkened(0.3)))

	# Title
	var result_label := Label.new()
	result_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	result_label.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["title"])
	if _compact_font:
		result_label.add_theme_font_override("font", _compact_font)

	if player_won:
		result_label.text = "~ VICTORY ~"
		result_label.add_theme_color_override("font_color", ThemeManager.COLOR_GOLD_BRIGHT)
		victory_vbox.add_child(result_label)
		_play_sfx_throttled(_sfx_victory, 0.0)
	else:
		result_label.text = "~ DEFEAT ~"
		result_label.add_theme_color_override("font_color", ThemeManager.COLOR_HP_RED)
		victory_vbox.add_child(result_label)
		_play_sfx_throttled(_sfx_defeat, 0.0)

	# Separator
	victory_vbox.add_child(ThemeManager.make_separator(accent.darkened(0.2)))

	# Opponent name subtitle
	var opp_name := str(engine.h2.get("name", "Opponent"))
	var opp_lbl := Label.new()
	opp_lbl.text = "vs " + opp_name
	opp_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	opp_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	opp_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
	if _compact_font:
		opp_lbl.add_theme_font_override("font", _compact_font)
	victory_vbox.add_child(opp_lbl)

	# Compact stat line — centered
	var h1_dmg := roundi(float(engine.h1.get("tot_dmg", 0)))
	var h2_dmg := roundi(float(engine.h2.get("tot_dmg", 0)))
	var h1_hp := maxi(0, roundi(float(engine.h1.get("hp", 0))))
	var h1_max := maxi(1, roundi(float(engine.h1.get("max_hp", 1))))
	var time_sec := snappedf(float(engine.bt) / 1000.0, 0.1)
	var hp_pct := roundi(float(h1_hp) / float(h1_max) * 100.0)

	var stat_lbl := Label.new()
	stat_lbl.text = str(h1_dmg) + " dealt  /  " + str(h2_dmg) + " taken  /  " + str(hp_pct) + "% HP  /  " + str(time_sec) + "s"
	stat_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stat_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["small"])
	stat_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT)
	if _compact_font:
		stat_lbl.add_theme_font_override("font", _compact_font)
	victory_vbox.add_child(stat_lbl)

	# Mode-specific info
	if _mode == "ladder":
		var run: Dictionary = _gs.ladder_run
		var wins: int = int(run.get("wins", 0))
		var mode_lbl := Label.new()
		if player_won:
			mode_lbl.text = "Round " + str(wins + 1) + " Complete!"
			mode_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_HP_GREEN)
		else:
			mode_lbl.text = "Ladder Over  -  " + str(wins) + " wins"
			mode_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_HP_RED)
		mode_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		mode_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		if _compact_font:
			mode_lbl.add_theme_font_override("font", _compact_font)
		victory_vbox.add_child(mode_lbl)
	elif _mode == "arena":
		var mode_lbl := Label.new()
		mode_lbl.text = "Arena " + ("WIN" if player_won else "LOSS")
		mode_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		mode_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
		mode_lbl.add_theme_color_override("font_color", Color(0.7, 0.5, 1.0))
		if _compact_font:
			mode_lbl.add_theme_font_override("font", _compact_font)
		victory_vbox.add_child(mode_lbl)

	# Flavor quote
	var quote_pool: Array[String] = WIN_QUOTES if player_won else LOSS_QUOTES
	var quote_lbl := Label.new()
	quote_lbl.text = quote_pool[randi() % quote_pool.size()]
	quote_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	quote_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	quote_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["body"])
	quote_lbl.add_theme_color_override("font_color", ThemeManager.COLOR_TEXT_LIGHT.darkened(0.2))
	victory_vbox.add_child(quote_lbl)

	# Bottom decorative line
	victory_vbox.add_child(ThemeManager.make_hrule(accent.darkened(0.3)))

	# Spacer
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 3)
	victory_vbox.add_child(spacer)

	victory_overlay.visible = true


func _spawn_screen_flash(color: Color) -> void:
	var flash := ColorRect.new()
	flash.color = color
	flash.size = Vector2(960, 540)
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(flash)
	var tw := create_tween()
	tw.tween_property(flash, "color:a", 0.0, 0.2)
	tw.tween_callback(flash.queue_free)


func _screen_shake(intensity: float, duration: float) -> void:
	var arena_layer: Node2D = $ArenaLayer
	var origin := arena_layer.position
	var tw := create_tween()
	var steps := 6
	for i in range(steps):
		var fade := 1.0 - float(i) / float(steps)
		var offset_x := randf_range(-intensity, intensity) * fade
		var offset_y := randf_range(-intensity * 0.5, intensity * 0.5) * fade
		tw.tween_property(arena_layer, "position", origin + Vector2(offset_x, offset_y), duration / float(steps))
	tw.tween_property(arena_layer, "position", origin, 0.02)


func _spawn_entity_status_particles(node: Node2D, h: Dictionary) -> void:
	if node == null or h.is_empty():
		return
	for key in STATUS_PARTICLES:
		var active := false
		if h.has(key):
			var val = h[key]
			if val is bool:
				active = val
			elif val is float:
				active = val > 0
			elif val is int:
				active = val > 0
		if active:
			_spawn_status_particle(node.position, STATUS_PARTICLES[key])


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


func _play_sfx_throttled(stream: AudioStream, min_gap: float = 0.15) -> void:
	var now := Time.get_ticks_msec() / 1000.0
	if now - _last_sfx_time >= min_gap:
		var sfx_mgr := get_node_or_null("/root/SfxManager")
		if sfx_mgr:
			sfx_mgr.play_sfx(stream)
		_last_sfx_time = now


func _set_speed(spd: int) -> void:
	engine.speed_multiplier = spd


func _on_back() -> void:
	engine.stop()
	TransitionManager.fade_to_scene("res://scenes/character_forge/character_forge.tscn")


# ============ RESULT HANDLERS ============

func _handle_dungeon_result(player_won: bool) -> void:
	var r: Dictionary = _gs.dg_run
	# Sync HP back to run
	r["hp"] = maxi(0, roundi(float(engine.h1.get("hp", 0))))
	var dmg_dealt := roundi(float(engine.h1.get("tot_dmg", 0)))
	var dmg_taken := roundi(float(engine.h2.get("tot_dmg", 0)))
	r["total_dmg_dealt"] = int(r.get("total_dmg_dealt", 0)) + dmg_dealt
	r["total_dmg_taken"] = int(r.get("total_dmg_taken", 0)) + dmg_taken

	# Update last_combat_stats for victory screen
	var lcs: Dictionary = r.get("last_combat_stats", {})
	lcs["dmg_dealt"] = dmg_dealt
	lcs["dmg_taken"] = dmg_taken
	r["last_combat_stats"] = lcs

	if player_won:
		r["state"] = "combat_won"
		r["combat_enemy"] = {}
	else:
		r["state"] = "dead"
		r["hp"] = 0

	var timer := get_tree().create_timer(1.0)
	timer.timeout.connect(func(): TransitionManager.fade_to_scene("res://scenes/dungeon/dungeon.tscn"))


func _handle_ladder_result(player_won: bool) -> void:
	# Store result + combat stats for ladder intermission
	_gs._ladder_result = "win" if player_won else "loss"
	_gs.ladder_run["last_player_hp"] = maxi(0, roundi(float(engine.h1.get("hp", 0))))
	_gs.ladder_run["last_player_max_hp"] = roundi(float(engine.h1.get("max_hp", 1)))
	_gs.ladder_run["last_opp_hp"] = maxi(0, roundi(float(engine.h2.get("hp", 0))))
	var timer := get_tree().create_timer(1.0)
	if _gs._tutorial_return:
		_gs._tutorial_return = false
		timer.timeout.connect(func(): TransitionManager.fade_to_scene("res://scenes/tutorial/tutorial.tscn"))
	else:
		timer.timeout.connect(func(): TransitionManager.fade_to_scene("res://scenes/ladder/ladder.tscn"))


func _handle_arena_result(player_won: bool) -> void:
	# Store result for arena scene to process
	_gs._arena_staked["result"] = "win" if player_won else "loss"
	_gs._arena_staked["last_player_hp"] = maxi(0, roundi(float(engine.h1.get("hp", 0))))
	_gs._arena_staked["last_opp_hp"] = maxi(0, roundi(float(engine.h2.get("hp", 0))))

	# Report to server
	var net: Node = get_node_or_null("/root/Network")
	var opp_id: String = str(_gs._arena_staked.get("opponent_id", ""))
	if net and not opp_id.is_empty():
		net.report_battle(opp_id, player_won)

	# Handle staked follower loss
	var staked_idx: int = int(_gs._arena_staked.get("index", -1))
	if staked_idx >= 0 and staked_idx < _gs.followers.size():
		if not player_won:
			_gs.followers.remove_at(staked_idx)
	_gs._arena_staked["index"] = -1
	_gs._arena_fighters = []

	var timer := get_tree().create_timer(1.5)
	timer.timeout.connect(func(): TransitionManager.fade_to_scene("res://scenes/arena/arena.tscn"))
