class_name LayeredSprite
extends Node2D
## Composites a single base Sprite2D for heroes, monsters, and followers.
## Each sprite references a 192x64 horizontal strip with 3 poses: idle | attack | hurt.

# Asset paths
const HERO_BASE_PATH := "res://assets/sprites/generated/heroes/"
const MONSTER_PATH := "res://assets/sprites/generated/monsters/"
const FOLLOWER_PATH := "res://assets/sprites/generated/followers/"

# Pose regions within a 192x64 strip
const POSE_IDLE := Rect2(0, 0, 64, 64)
const POSE_ATTACK := Rect2(64, 0, 64, 64)
const POSE_HURT := Rect2(128, 0, 64, 64)

const POSES := {
	"idle": POSE_IDLE,
	"attack": POSE_ATTACK,
	"hurt": POSE_HURT,
}

var _class_key: String = ""
var _current_pose: String = "idle"
var _is_flipped: bool = false
var _base_sprite: Sprite2D
var _atlas_texture: AtlasTexture
var _idle_tween: Tween
var _initialized: bool = false


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


## Set the hero class and load the base sprite.
func set_class(class_key: String) -> void:
	_ensure_sprite()
	_class_key = class_key
	var path := HERO_BASE_PATH + class_key + "_base.png"
	_load_sprite(path)


## Load a monster sprite (single entity).
func set_monster(monster_name: String) -> void:
	_ensure_sprite()
	var safe_name := monster_name.strip_edges().to_lower().replace("*", "").strip_edges().replace(" ", "_")
	var path := MONSTER_PATH + safe_name + ".png"
	_load_sprite(path)


## Load a follower sprite (single frame, no strip).
func set_follower(follower_key: String) -> void:
	_ensure_sprite()
	var safe_name := follower_key.to_lower().replace(" ", "_")
	var path := FOLLOWER_PATH + safe_name + ".png"
	var tex = load(path)
	if tex:
		_base_sprite.texture = tex
		_base_sprite.visible = true
		_atlas_texture = null  # Not a strip


## Flip horizontally (for left/right positioning).
func set_flipped(flipped: bool) -> void:
	_ensure_sprite()
	_is_flipped = flipped
	_base_sprite.flip_h = flipped


## Switch to the specified pose (idle, attack, hurt).
func set_pose(pose: String) -> void:
	if not POSES.has(pose):
		return
	_current_pose = pose
	if _atlas_texture:
		_atlas_texture.region = POSES[pose]


## Play attack animation: lunge toward target + squash-stretch + return.
func play_attack(toward_x: float, duration: float = 0.25) -> void:
	var origin_x := position.x
	var origin_sy := scale.y
	var origin_sx := scale.x
	var lunge_dist := (toward_x - position.x) * 0.3
	set_pose("attack")
	var tw := create_tween()
	# Wind-up squash
	tw.tween_property(self, "scale", Vector2(origin_sx * 0.9, origin_sy * 1.1), duration * 0.15)
	# Lunge forward + stretch
	tw.tween_property(self, "position:x", origin_x + lunge_dist, duration * 0.35).set_trans(Tween.TRANS_BACK)
	tw.parallel().tween_property(self, "scale", Vector2(origin_sx * 1.15, origin_sy * 0.9), duration * 0.35)
	# Return to idle
	tw.tween_callback(set_pose.bind("idle"))
	tw.tween_property(self, "position:x", origin_x, duration * 0.35).set_trans(Tween.TRANS_QUAD)
	tw.parallel().tween_property(self, "scale", Vector2(origin_sx, origin_sy), duration * 0.15)


## Play cast/ranged animation: lean back slightly + flash + return (no lunge).
func play_cast(duration: float = 0.2) -> void:
	var origin_x := position.x
	var origin_sy := scale.y
	var origin_sx := scale.x
	var lean_back := -3.0 if not _is_flipped else 3.0
	set_pose("attack")
	var tw := create_tween()
	# Lean back
	tw.tween_property(self, "position:x", origin_x + lean_back, duration * 0.3)
	tw.parallel().tween_property(self, "scale", Vector2(origin_sx * 0.95, origin_sy * 1.05), duration * 0.3)
	# Return to idle
	tw.tween_callback(set_pose.bind("idle"))
	tw.tween_property(self, "position:x", origin_x, duration * 0.4).set_trans(Tween.TRANS_QUAD)
	tw.parallel().tween_property(self, "scale", Vector2(origin_sx, origin_sy), duration * 0.3)


## Play hurt animation: flash red + knockback + return.
func play_hurt(duration: float = 0.25) -> void:
	var origin_x := position.x
	var knockback := 4.0 if not _is_flipped else -4.0
	set_pose("hurt")
	modulate = Color(1.0, 0.3, 0.3)
	var tw := create_tween()
	# Knockback
	tw.tween_property(self, "position:x", origin_x - knockback, duration * 0.3).set_trans(Tween.TRANS_QUAD)
	# Flash back to white + return
	tw.tween_property(self, "modulate", Color.WHITE, duration * 0.4)
	tw.parallel().tween_property(self, "position:x", origin_x, duration * 0.3)
	tw.tween_callback(set_pose.bind("idle"))


## Play death animation: collapse + fade out.
func play_death(duration: float = 0.5) -> void:
	set_pose("hurt")
	modulate = Color(1.0, 0.3, 0.3)
	var tw := create_tween()
	tw.tween_property(self, "scale:y", 0.0, duration * 0.6).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	tw.parallel().tween_property(self, "modulate:a", 0.0, duration)
	tw.parallel().tween_property(self, "position:y", position.y + 16, duration * 0.6)


## Start idle bobbing animation.
func start_idle_bob(amplitude: float = 1.0, period: float = 1.5) -> void:
	if _idle_tween:
		_idle_tween.kill()
	_idle_tween = create_tween().set_loops()
	_idle_tween.tween_property(self, "position:y", position.y - amplitude, period * 0.5).set_trans(Tween.TRANS_SINE)
	_idle_tween.tween_property(self, "position:y", position.y + amplitude, period * 0.5).set_trans(Tween.TRANS_SINE)


## Stop idle bobbing.
func stop_idle_bob() -> void:
	if _idle_tween:
		_idle_tween.kill()
		_idle_tween = null


# ── Internal ──────────────────────────────────────────────────────────

func _load_sprite(path: String) -> void:
	var tex = load(path)
	if not tex:
		_base_sprite.visible = false
		return

	# Check if it's a 3-frame strip (width ~= 3 * height) or a single frame
	var tex_width: int = tex.get_width()
	var tex_height: int = tex.get_height()

	if tex_width >= tex_height * 2:
		# Strip format — use AtlasTexture with pose regions
		var atlas := AtlasTexture.new()
		atlas.atlas = tex
		atlas.region = POSES.get(_current_pose, POSE_IDLE)
		_base_sprite.texture = atlas
		_atlas_texture = atlas
	else:
		# Single frame — use directly
		_base_sprite.texture = tex
		_atlas_texture = null

	_base_sprite.visible = true
	_base_sprite.flip_h = _is_flipped
