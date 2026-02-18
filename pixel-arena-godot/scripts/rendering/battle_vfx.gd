class_name BattleVFX
extends Node
## Combat VFX helper — preloads generated VFX textures and spawns
## weapon-specific melee slashes, projectile sprites, hit impacts,
## death effects. Falls back to ColorRect when textures are missing.

const VFX_BASE := "res://assets/sprites/generated/vfx/"

# Preloaded textures keyed by short name (e.g. "slash_sword", "proj_arrow")
var _tex: Dictionary = {}


func _ready() -> void:
	_preload()


func _preload() -> void:
	var keys: Array = [
		"vfx_slash_sword", "vfx_slash_daggers", "vfx_chop_axe",
		"vfx_sweep_scythe", "vfx_slash_claw",
		"vfx_proj_arrow", "vfx_proj_knife", "vfx_proj_orb",
		"vfx_hit_slash", "vfx_hit_arrow", "vfx_hit_magic", "vfx_hit_crit",
		"vfx_death_soul",
	]
	for key in keys:
		var path: String = VFX_BASE + str(key) + ".png"
		if ResourceLoader.exists(path):
			var tex = load(path)
			if tex:
				_tex[key] = tex


# ============ WEAPON TYPE → VFX KEY MAPPINGS ============

const MELEE_VFX_MAP: Dictionary = {
	"sword": "vfx_slash_sword",
	"daggers": "vfx_slash_daggers",
	"axe": "vfx_chop_axe",
	"scythe": "vfx_sweep_scythe",
	"claw": "vfx_slash_claw",
}

const PROJ_VFX_MAP: Dictionary = {
	"bow": "vfx_proj_arrow",
	"daggers": "vfx_proj_knife",
	"staff": "vfx_proj_orb",
}

const HIT_VFX_MAP: Dictionary = {
	"sword": "vfx_hit_slash",
	"daggers": "vfx_hit_slash",
	"axe": "vfx_hit_slash",
	"scythe": "vfx_hit_slash",
	"claw": "vfx_hit_slash",
	"bow": "vfx_hit_arrow",
	"staff": "vfx_hit_magic",
}


# ============ MELEE VFX ============

## Spawn a melee slash/chop/sweep at the target's screen position.
func spawn_melee_vfx(weapon_type: String, screen_pos: Vector2, direction: float, container: Node2D) -> void:
	var vfx_key: String = MELEE_VFX_MAP.get(weapon_type, "vfx_slash_sword")
	var tex: Texture2D = _tex.get(vfx_key)
	if not tex:
		# Fallback: simple white flash
		_spawn_fallback_slash(screen_pos, direction, container)
		return

	var sprite := Sprite2D.new()
	sprite.texture = tex
	sprite.position = screen_pos
	sprite.scale = Vector2(0.05, 0.05)
	sprite.modulate.a = 0.9
	if direction < 0:
		sprite.flip_h = true
	container.add_child(sprite)

	var tw := container.create_tween()
	tw.tween_property(sprite, "scale", Vector2(0.5, 0.5), 0.12)
	tw.parallel().tween_property(sprite, "modulate:a", 0.6, 0.12)
	tw.tween_property(sprite, "modulate:a", 0.0, 0.1)
	tw.tween_callback(sprite.queue_free)


func _spawn_fallback_slash(pos: Vector2, direction: float, container: Node2D) -> void:
	var slash := ColorRect.new()
	slash.size = Vector2(12, 2)
	slash.color = Color(1.0, 1.0, 0.8, 0.8)
	slash.position = pos + Vector2(-6, -1)
	slash.rotation = -0.4 if direction > 0 else 0.4
	container.add_child(slash)
	var tw := container.create_tween()
	tw.tween_property(slash, "modulate:a", 0.0, 0.15)
	tw.tween_callback(slash.queue_free)


# ============ PROJECTILE NODES ============

## Create a projectile Node2D with the appropriate sprite. Rotation is updated
## by the caller each frame based on movement direction.
func create_projectile_node(weapon_type: String, color: String) -> Node2D:
	var wrapper := Node2D.new()
	var vfx_key: String = PROJ_VFX_MAP.get(weapon_type, "")
	var tex: Texture2D = _tex.get(vfx_key) if not vfx_key.is_empty() else null

	if tex:
		var sprite := Sprite2D.new()
		sprite.texture = tex
		sprite.scale = Vector2(0.5, 0.5)
		# Tint magic orbs by weapon glow color
		if weapon_type == "staff" and not color.is_empty():
			sprite.modulate = Color.from_string(color, Color.WHITE)
		wrapper.add_child(sprite)
	else:
		# Fallback: colored rectangle (original behavior)
		var rect := ColorRect.new()
		rect.size = Vector2(4, 3)
		rect.position = Vector2(-2, -1.5)
		rect.color = Color.from_string(color, Color.WHITE)
		wrapper.add_child(rect)

	return wrapper


# ============ HIT IMPACTS ============

## Spawn a hit impact VFX at screen position. weapon_type determines the style.
func spawn_hit_impact(weapon_type: String, screen_pos: Vector2, amount: float, is_crit: bool, container: Node2D) -> void:
	# Weapon-specific impact
	var vfx_key: String = HIT_VFX_MAP.get(weapon_type, "vfx_hit_slash")
	var tex: Texture2D = _tex.get(vfx_key)
	if tex:
		_spawn_impact_sprite(tex, screen_pos, amount, container)
	else:
		_spawn_fallback_sparks(screen_pos, amount, container)

	# Crit overlay
	if is_crit:
		var crit_tex: Texture2D = _tex.get("vfx_hit_crit")
		if crit_tex:
			var crit_sprite := Sprite2D.new()
			crit_sprite.texture = crit_tex
			crit_sprite.position = screen_pos
			crit_sprite.scale = Vector2(0.1, 0.1)
			crit_sprite.modulate = Color(1.0, 0.95, 0.7, 0.9)
			container.add_child(crit_sprite)
			var tw := container.create_tween()
			tw.tween_property(crit_sprite, "scale", Vector2(0.6, 0.6), 0.15)
			tw.parallel().tween_property(crit_sprite, "modulate:a", 0.0, 0.25)
			tw.tween_callback(crit_sprite.queue_free)


func _spawn_impact_sprite(tex: Texture2D, pos: Vector2, _amount: float, container: Node2D) -> void:
	var sprite := Sprite2D.new()
	sprite.texture = tex
	sprite.position = pos + Vector2(randf_range(-3, 3), randf_range(-3, 3))
	sprite.scale = Vector2(0.15, 0.15)
	sprite.modulate.a = 0.85
	sprite.rotation = randf_range(-0.3, 0.3)
	container.add_child(sprite)
	var tw := container.create_tween()
	tw.tween_property(sprite, "scale", Vector2(0.35, 0.35), 0.15)
	tw.parallel().tween_property(sprite, "modulate:a", 0.0, 0.25)
	tw.tween_callback(sprite.queue_free)


func _spawn_fallback_sparks(pos: Vector2, amount: float, container: Node2D) -> void:
	var count := clampi(roundi(amount / 100.0), 2, 6)
	for i in range(count):
		var spark := ColorRect.new()
		spark.size = Vector2(2, 2)
		spark.position = pos + Vector2(randf_range(-6, 6), randf_range(-4, 4))
		spark.color = Color(1.0, 0.8 + randf() * 0.2, 0.3, 1.0)
		container.add_child(spark)
		var tw := container.create_tween()
		var dir := Vector2(randf_range(-12, 12), randf_range(-16, -4))
		tw.tween_property(spark, "position", spark.position + dir, 0.3 + randf() * 0.15)
		tw.parallel().tween_property(spark, "modulate:a", 0.0, 0.3 + randf() * 0.15)
		tw.tween_callback(spark.queue_free)


# ============ DEATH EFFECTS ============

## Spawn rising soul wisps at the position of a dying entity.
func spawn_death_effect(screen_pos: Vector2, container: Node2D) -> void:
	var soul_tex: Texture2D = _tex.get("vfx_death_soul")
	for i in range(randi_range(3, 5)):
		var offset := Vector2(randf_range(-8, 8), randf_range(-4, 4))
		if soul_tex:
			var sprite := Sprite2D.new()
			sprite.texture = soul_tex
			sprite.position = screen_pos + offset
			sprite.scale = Vector2(0.2, 0.2)
			sprite.modulate.a = 0.6
			container.add_child(sprite)
			var tw := container.create_tween()
			tw.tween_property(sprite, "position:y", sprite.position.y - 30 - randf() * 15, 0.8 + randf() * 0.4)
			tw.parallel().tween_property(sprite, "modulate:a", 0.0, 0.8 + randf() * 0.4)
			tw.parallel().tween_property(sprite, "scale", Vector2(0.1, 0.1), 0.8)
			tw.tween_callback(sprite.queue_free)
		else:
			# Fallback: small white fading square
			var sq := ColorRect.new()
			sq.size = Vector2(2, 2)
			sq.position = screen_pos + offset
			sq.color = Color(0.7, 0.8, 1.0, 0.5)
			container.add_child(sq)
			var tw := container.create_tween()
			tw.tween_property(sq, "position:y", sq.position.y - 25, 0.8)
			tw.parallel().tween_property(sq, "modulate:a", 0.0, 0.8)
			tw.tween_callback(sq.queue_free)
