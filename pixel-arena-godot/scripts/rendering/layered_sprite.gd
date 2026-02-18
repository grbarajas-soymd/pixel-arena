class_name LayeredSprite
extends Node2D
## Composites a single base Sprite2D for heroes, monsters, and followers.
##
## Supports two sprite formats:
##   Legacy: 192x64 horizontal strip with 3 poses (idle | attack | hurt)
##   Sheet:  384x384 grid (6 cols × 6 rows of 64x64 cells) with JSON anim data
##
## Sheet rows: idle(0), attack(1), hurt(2), cast(3), death(4), walk(5)

# Asset paths
const HERO_BASE_PATH := "res://assets/sprites/generated/heroes/"
const MONSTER_PATH := "res://assets/sprites/generated/monsters/"
const FOLLOWER_PATH := "res://assets/sprites/generated/followers/"
const WEAPON_PATH := "res://assets/sprites/generated/weapons/"

# Map gear base_key → weapon overlay type (mirrors WEAPON_TYPE_MAP in generate_sprites.py)
const WEAPON_TYPE_MAP := {
	"rusty_blade": "sword", "iron_sword": "sword", "great_sword": "sword",
	"soulreaver": "sword",
	"war_axe": "axe",
	"wooden_bow": "bow", "shortbow": "bow", "longbow": "bow",
	"astral_longbow": "bow",
	"worn_wand": "staff", "arcane_staff": "staff", "crystal_staff": "staff",
	"rusty_daggers": "daggers", "hunting_knives": "daggers",
	"frost_daggers": "daggers",
	"cursed_scythe": "scythe",
}

# Legacy pose regions within a 192x64 strip (backward compat)
const POSE_IDLE := Rect2(0, 0, 64, 64)
const POSE_ATTACK := Rect2(64, 0, 64, 64)
const POSE_HURT := Rect2(128, 0, 64, 64)

const POSES := {
	"idle": POSE_IDLE,
	"attack": POSE_ATTACK,
	"hurt": POSE_HURT,
}

# Default animation data when no JSON is found (fallback frame layout)
const DEFAULT_ANIM_DATA := {
	"frame_size": [64, 64],
	"animations": {
		"idle":   {"row": 0, "count": 6, "fps": 6, "loop": true},
		"attack": {"row": 1, "count": 6, "fps": 12, "loop": false, "next": "idle"},
		"hurt":   {"row": 2, "count": 4, "fps": 10, "loop": false, "next": "idle"},
		"cast":   {"row": 3, "count": 6, "fps": 8, "loop": false, "next": "idle"},
		"death":  {"row": 4, "count": 6, "fps": 6, "loop": false, "next": ""},
		"walk":   {"row": 5, "count": 6, "fps": 8, "loop": true},
	}
}

var _class_key: String = ""
var _current_pose: String = "idle"
var _is_flipped: bool = false
var _base_sprite: Sprite2D
var _atlas_texture: AtlasTexture
var _idle_tween: Tween
var _initialized: bool = false

# ── Sheet animation state ──────────────────────────────────────────
var _is_sheet: bool = false           # True if using new sheet format (not legacy strip)
var _anim_data: Dictionary = {}       # Loaded from .json or DEFAULT_ANIM_DATA
var _frame_size: Vector2i = Vector2i(64, 64)
var _current_anim: String = "idle"    # Current animation name
var _current_frame: int = 0           # Current frame index within animation
var _frame_timer: float = 0.0         # Accumulator for frame advancement
var _playing: bool = false            # Whether frame animation is active
var _anim_finished_callback: Callable # Called when a non-looping animation ends

# ── Weapon overlay ─────────────────────────────────────────────────
var _weapon_sprite: Sprite2D
var _weapon_atlas: AtlasTexture
var _weapon_anim_data: Dictionary = {}
var _has_weapon_overlay: bool = false


func _ready() -> void:
	_ensure_sprite()


## Lazily create the base sprite so calls before _ready() still work.
func _ensure_sprite() -> void:
	if _initialized:
		return
	_initialized = true
	_base_sprite = Sprite2D.new()
	_base_sprite.name = "BaseLayer"
	_base_sprite.visible = false
	add_child(_base_sprite)


func _process(delta: float) -> void:
	if not _is_sheet or not _playing:
		return
	_tick_frame_animation(delta)


# ── Public API: Loading ────────────────────────────────────────────

## Set the hero class and load the base sprite.
func set_class(class_key: String) -> void:
	_ensure_sprite()
	_class_key = class_key
	var sheet_path := HERO_BASE_PATH + class_key + "_base.png"
	var json_path := HERO_BASE_PATH + class_key + "_base.json"
	_load_sprite_auto(sheet_path, json_path)


## Load a monster sprite (single entity).
func set_monster(monster_name: String) -> void:
	_ensure_sprite()
	var safe_name := monster_name.strip_edges().to_lower().replace("*", "").strip_edges().replace(" ", "_")
	var sheet_path := MONSTER_PATH + safe_name + ".png"
	var json_path := MONSTER_PATH + safe_name + ".json"
	_load_sprite_auto(sheet_path, json_path)


## Load a follower sprite (single frame or sheet).
func set_follower(follower_key: String) -> void:
	_ensure_sprite()
	var safe_name := follower_key.to_lower().replace(" ", "_")
	var sheet_path := FOLLOWER_PATH + safe_name + ".png"
	var json_path := FOLLOWER_PATH + safe_name + ".json"
	_load_sprite_auto(sheet_path, json_path)


## Flip horizontally (for left/right positioning).
func set_flipped(flipped: bool) -> void:
	_ensure_sprite()
	_is_flipped = flipped
	_base_sprite.flip_h = flipped
	if _weapon_sprite:
		_weapon_sprite.flip_h = flipped


## Load a weapon overlay sheet (FFT WEP style).
func set_weapon_overlay(weapon_type: String) -> void:
	_ensure_sprite()
	if weapon_type.is_empty():
		_clear_weapon_overlay()
		return
	var sheet_path := WEAPON_PATH + weapon_type + ".png"
	var json_path := WEAPON_PATH + weapon_type + ".json"
	var tex = load(sheet_path)
	if not tex:
		_clear_weapon_overlay()
		return
	if not _weapon_sprite:
		_weapon_sprite = Sprite2D.new()
		_weapon_sprite.name = "WeaponLayer"
		add_child(_weapon_sprite)
	var atlas := AtlasTexture.new()
	atlas.atlas = tex
	atlas.region = Rect2(0, 0, _frame_size.x, _frame_size.y)
	_weapon_sprite.texture = atlas
	_weapon_atlas = atlas
	_weapon_sprite.visible = true
	_weapon_sprite.flip_h = _is_flipped
	_has_weapon_overlay = true
	# Load weapon anim data
	_weapon_anim_data = _try_load_json(json_path)


# ── Public API: Pose / Animation ───────────────────────────────────

## Switch to the specified pose (legacy strip: idle, attack, hurt).
func set_pose(pose: String) -> void:
	if _is_sheet:
		# Map legacy pose names to sheet animations
		play_anim(pose)
		return
	if not POSES.has(pose):
		return
	_current_pose = pose
	if _atlas_texture:
		_atlas_texture.region = POSES[pose]


## Start a named frame-by-frame animation (sheet mode).
## If the sprite is in legacy mode, falls back to set_pose().
func play_anim(anim_name: String, force: bool = false) -> void:
	if not _is_sheet:
		# Legacy fallback: map to closest pose
		if POSES.has(anim_name):
			_current_pose = anim_name
			if _atlas_texture:
				_atlas_texture.region = POSES[anim_name]
		return

	var anims: Dictionary = _anim_data.get("animations", {})
	if not anims.has(anim_name):
		return
	if _current_anim == anim_name and _playing and not force:
		return

	_current_anim = anim_name
	_current_frame = 0
	_frame_timer = 0.0
	_playing = true
	_apply_frame()


## Play attack animation: frame-based attack + lunge toward target.
func play_attack(toward_x: float, duration: float = 0.25) -> void:
	var origin_x := position.x
	var origin_sy := scale.y
	var origin_sx := scale.x
	var lunge_dist := (toward_x - position.x) * 0.3

	if _is_sheet:
		play_anim("attack", true)
	else:
		set_pose("attack")

	var tw := create_tween()
	# Wind-up squash
	tw.tween_property(self, "scale", Vector2(origin_sx * 0.9, origin_sy * 1.1), duration * 0.15)
	# Lunge forward + stretch
	tw.tween_property(self, "position:x", origin_x + lunge_dist, duration * 0.35).set_trans(Tween.TRANS_BACK)
	tw.parallel().tween_property(self, "scale", Vector2(origin_sx * 1.15, origin_sy * 0.9), duration * 0.35)
	# Return
	if not _is_sheet:
		tw.tween_callback(set_pose.bind("idle"))
	tw.tween_property(self, "position:x", origin_x, duration * 0.35).set_trans(Tween.TRANS_QUAD)
	tw.parallel().tween_property(self, "scale", Vector2(origin_sx, origin_sy), duration * 0.15)


## Play hurt animation: frame-based hurt + flash red + knockback.
func play_hurt(duration: float = 0.25) -> void:
	var origin_x := position.x
	var knockback := 4.0 if not _is_flipped else -4.0

	if _is_sheet:
		play_anim("hurt", true)
	else:
		set_pose("hurt")

	modulate = Color(1.0, 0.3, 0.3)
	var tw := create_tween()
	tw.tween_property(self, "position:x", origin_x - knockback, duration * 0.3).set_trans(Tween.TRANS_QUAD)
	tw.tween_property(self, "modulate", Color.WHITE, duration * 0.4)
	tw.parallel().tween_property(self, "position:x", origin_x, duration * 0.3)
	if not _is_sheet:
		tw.tween_callback(set_pose.bind("idle"))


## Play death animation: frame-based death + collapse + fade.
func play_death(duration: float = 0.5) -> void:
	if _is_sheet:
		play_anim("death", true)
	else:
		set_pose("hurt")

	modulate = Color(1.0, 0.3, 0.3)
	var tw := create_tween()
	tw.tween_property(self, "scale:y", 0.0, duration * 0.6).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	tw.parallel().tween_property(self, "modulate:a", 0.0, duration)
	tw.parallel().tween_property(self, "position:y", position.y + 16, duration * 0.6)


## Play cast animation (sheet only — no legacy equivalent).
func play_cast(duration: float = 0.35) -> void:
	if _is_sheet:
		play_anim("cast", true)
	else:
		set_pose("attack")  # Legacy fallback: use attack pose for casting

	# Casting glow overlay
	modulate = Color(1.0, 1.0, 1.3, 1.0)
	var tw := create_tween()
	tw.tween_property(self, "modulate", Color.WHITE, duration)


## Start idle animation. In sheet mode, plays the idle frame loop.
## In legacy mode, falls back to tween-based bobbing.
func start_idle_bob(amplitude: float = 1.0, period: float = 1.5) -> void:
	if _is_sheet:
		play_anim("idle")
		return
	# Legacy tween-based bob
	if _idle_tween:
		_idle_tween.kill()
	_idle_tween = create_tween().set_loops()
	_idle_tween.tween_property(self, "position:y", position.y - amplitude, period * 0.5).set_trans(Tween.TRANS_SINE)
	_idle_tween.tween_property(self, "position:y", position.y + amplitude, period * 0.5).set_trans(Tween.TRANS_SINE)


## Stop idle bobbing (legacy) or idle animation (sheet).
func stop_idle_bob() -> void:
	if _idle_tween:
		_idle_tween.kill()
		_idle_tween = null
	if _is_sheet:
		_playing = false


## Play walk animation (sheet only).
func play_walk() -> void:
	play_anim("walk")


## Check if using the new sheet format.
func is_sheet_mode() -> bool:
	return _is_sheet


## Get the current animation name.
func get_current_anim() -> String:
	return _current_anim if _is_sheet else _current_pose


## Load weapon overlay from hero equipment data.
## equipment: Dictionary with slot keys like "weapon" containing {base_key: "iron_sword", ...}
func set_weapon_from_equipment(equipment: Dictionary) -> void:
	var weapon_data: Dictionary = equipment.get("weapon", {})
	if weapon_data.is_empty():
		return
	var base_key: String = str(weapon_data.get("base_key", weapon_data.get("baseKey", "")))
	if base_key.is_empty():
		return
	var weapon_type: String = WEAPON_TYPE_MAP.get(base_key, "")
	if not weapon_type.is_empty():
		set_weapon_overlay(weapon_type)


# ── Internal: Loading ──────────────────────────────────────────────

## Auto-detect format: try sheet+JSON first, fall back to legacy strip/single.
func _load_sprite_auto(sheet_path: String, json_path: String) -> void:
	var tex = load(sheet_path)
	if not tex:
		_base_sprite.visible = false
		_is_sheet = false
		return

	var tex_w: int = tex.get_width()
	var tex_h: int = tex.get_height()

	# Try to load anim JSON
	var anim_json := _try_load_json(json_path)

	# Detect format: if we have anim JSON or the texture is square/tall (sheet), use sheet mode
	if not anim_json.is_empty():
		_setup_sheet(tex, anim_json)
	elif tex_w == tex_h or (tex_w > tex_h and tex_w != tex_h * 3):
		# Square or non-3x aspect = assume sheet with default anim data
		_setup_sheet(tex, DEFAULT_ANIM_DATA)
	elif tex_w >= tex_h * 2:
		# Legacy 3-frame strip
		_setup_legacy_strip(tex)
	else:
		# Single frame
		_base_sprite.texture = tex
		_atlas_texture = null
		_is_sheet = false

	_base_sprite.visible = true
	_base_sprite.flip_h = _is_flipped


func _setup_sheet(tex: Texture2D, anim_data: Dictionary) -> void:
	_is_sheet = true
	_anim_data = anim_data
	var fs: Array = anim_data.get("frame_size", [64, 64])
	_frame_size = Vector2i(int(fs[0]), int(fs[1]))

	var atlas := AtlasTexture.new()
	atlas.atlas = tex
	atlas.region = Rect2(0, 0, _frame_size.x, _frame_size.y)
	_base_sprite.texture = atlas
	_atlas_texture = atlas

	# Start idle animation by default
	_current_anim = "idle"
	_current_frame = 0
	_frame_timer = 0.0
	_playing = true
	_apply_frame()


func _setup_legacy_strip(tex: Texture2D) -> void:
	_is_sheet = false
	_anim_data = {}
	var atlas := AtlasTexture.new()
	atlas.atlas = tex
	atlas.region = POSES.get(_current_pose, POSE_IDLE)
	_base_sprite.texture = atlas
	_atlas_texture = atlas


func _try_load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var f := FileAccess.open(path, FileAccess.READ)
	if not f:
		return {}
	var text := f.get_as_text()
	f.close()
	var data = JSON.parse_string(text)
	if data is Dictionary:
		return data
	return {}


# ── Internal: Frame Animation ─────────────────────────────────────

func _tick_frame_animation(delta: float) -> void:
	var anims: Dictionary = _anim_data.get("animations", {})
	if not anims.has(_current_anim):
		return

	var anim: Dictionary = anims[_current_anim]
	var fps: float = float(anim.get("fps", 6))
	var count: int = int(anim.get("count", 1))
	var is_loop: bool = anim.get("loop", false)

	if count <= 1:
		return

	_frame_timer += delta
	var frame_dur := 1.0 / fps

	while _frame_timer >= frame_dur:
		_frame_timer -= frame_dur
		_current_frame += 1

		if _current_frame >= count:
			if is_loop:
				_current_frame = 0
			else:
				_current_frame = count - 1
				_playing = false
				# Transition to next animation if specified
				var next_anim: String = str(anim.get("next", ""))
				if not next_anim.is_empty() and anims.has(next_anim):
					play_anim(next_anim)
				if _anim_finished_callback.is_valid():
					_anim_finished_callback.call()
				return

	_apply_frame()


func _apply_frame() -> void:
	if not _atlas_texture:
		return

	var anims: Dictionary = _anim_data.get("animations", {})
	if not anims.has(_current_anim):
		return

	var anim: Dictionary = anims[_current_anim]
	var row: int = int(anim.get("row", 0))
	var col: int = _current_frame

	_atlas_texture.region = Rect2(
		col * _frame_size.x, row * _frame_size.y,
		_frame_size.x, _frame_size.y
	)

	# Sync weapon overlay frame if active
	if _has_weapon_overlay and _weapon_atlas:
		var w_anims: Dictionary = _weapon_anim_data.get("animations", {})
		if w_anims.has(_current_anim):
			var w_anim: Dictionary = w_anims[_current_anim]
			var w_row: int = int(w_anim.get("row", 0))
			var w_count: int = int(w_anim.get("count", 1))
			var w_col: int = mini(col, w_count - 1)
			_weapon_atlas.region = Rect2(
				w_col * _frame_size.x, w_row * _frame_size.y,
				_frame_size.x, _frame_size.y
			)


func _clear_weapon_overlay() -> void:
	_has_weapon_overlay = false
	if _weapon_sprite:
		_weapon_sprite.visible = false
	_weapon_anim_data = {}
