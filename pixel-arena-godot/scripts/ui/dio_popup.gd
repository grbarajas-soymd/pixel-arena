class_name DioPopup
extends CanvasLayer
## Lightweight non-blocking Dio popup — slides in from screen edge, shows
## sprite + speech bubble, plays stinger SFX, auto-dismisses after timeout.
## Does NOT block gameplay (no backdrop overlay, mouse passthrough on root).

const NPC_SPRITE_DIR := "res://assets/sprites/generated/npcs/"
const SPRITE_SIZE := 64.0
const BUBBLE_MAX_W := 200.0
const AUTO_DISMISS_SEC := 3.5
const ENTER_DURATION := 0.3
const EXIT_DURATION := 0.25

# Anti-stacking: class-level cooldown
static var _last_spawn_msec: int = 0
const COOLDOWN_MSEC: int = 45000

# Stinger SFX — loaded once
static var _stinger_pool: Array[AudioStream] = []
static var _stingers_loaded: bool = false

# Internal nodes
var _container: Control
var _tween: Tween
var _exit_pos: Vector2
var _dismissing: bool = false


static func spawn(parent: Node, context: String, _quality: int = -1) -> DioPopup:
	# Anti-stacking check
	var now := Time.get_ticks_msec()
	if now - _last_spawn_msec < COOLDOWN_MSEC:
		return null
	# Random chance gate — Dio doesn't always show up
	var chance := 0.35
	if context == "boss_kill":
		chance = 0.5
	elif context in ["death", "victory"]:
		chance = 0.6
	if randf() > chance:
		return null
	_last_spawn_msec = now

	var popup := DioPopup.new()
	popup._configure(context)
	parent.add_child(popup)
	return popup


var _sprite_key: String = "dio_idle"
var _text: String = "..."
var _entrance: String = "slide_left"


func _configure(context: String) -> void:
	var sprites: Array = DioData.get_sprites(context)
	_sprite_key = DioData.pick_random(sprites) if not sprites.is_empty() else "dio_idle"
	var lines: Array = DioData.get_lines(context)
	_text = DioData.pick_random(lines) if not lines.is_empty() else "..."
	var entrances: Array = DioData.get_entrances(context)
	_entrance = DioData.pick_random(entrances) if not entrances.is_empty() else "slide_left"


func _ready() -> void:
	layer = 45
	_load_stingers()
	_build_ui()
	_play_stinger()
	_animate_entrance()
	# Auto-dismiss timer
	get_tree().create_timer(AUTO_DISMISS_SEC).timeout.connect(_dismiss)


# ── UI Construction ────────────────────────────────────────────────────────

func _build_ui() -> void:
	_container = Control.new()
	_container.mouse_filter = Control.MOUSE_FILTER_PASS
	_container.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_container)

	# Clickable area — wraps sprite + bubble
	var click_area := Control.new()
	click_area.mouse_filter = Control.MOUSE_FILTER_STOP
	click_area.gui_input.connect(_on_click)
	_container.add_child(click_area)

	# Main HBox: sprite + speech bubble
	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 4)
	click_area.add_child(hbox)

	# Sprite
	var sprite_rect := TextureRect.new()
	sprite_rect.custom_minimum_size = Vector2(SPRITE_SIZE, SPRITE_SIZE)
	sprite_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	sprite_rect.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
	sprite_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED

	var tex: Texture2D = _load_sprite(_sprite_key)
	if tex:
		sprite_rect.texture = tex
	else:
		# Fallback: small "DIO" text rect
		var glow := ColorRect.new()
		glow.color = Color(0.15, 0.05, 0.0)
		glow.custom_minimum_size = Vector2(SPRITE_SIZE, SPRITE_SIZE)
		var lbl := Label.new()
		lbl.text = "DIO"
		lbl.add_theme_font_size_override("font_size", 10)
		lbl.add_theme_color_override("font_color", Color(1.0, 0.4, 0.1))
		lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		lbl.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		glow.add_child(lbl)
		hbox.add_child(glow)
		# Skip adding sprite_rect if using placeholder
		sprite_rect = null

	if sprite_rect:
		hbox.add_child(sprite_rect)

	# Speech bubble panel
	var bubble := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.04, 0.02, 0.92)
	style.border_color = Color(0.9, 0.35, 0.1)
	style.set_border_width_all(1)
	style.set_corner_radius_all(3)
	style.set_content_margin_all(4)
	bubble.add_theme_stylebox_override("panel", style)
	bubble.custom_minimum_size = Vector2(0, 0)
	hbox.add_child(bubble)

	var bvbox := VBoxContainer.new()
	bvbox.add_theme_constant_override("separation", 1)
	bubble.add_child(bvbox)

	# Pixel font for crisp rendering
	var pixel_font: Font = null
	var tm_node := get_node_or_null("/root/ThemeManager")
	if tm_node and tm_node.get("pixel_font"):
		pixel_font = tm_node.pixel_font

	# "Dio" name label
	var name_lbl := Label.new()
	name_lbl.text = "Dio"
	name_lbl.add_theme_font_size_override("font_size", ThemeManager.FONT_SIZES["heading"])
	name_lbl.add_theme_color_override("font_color", Color(1.0, 0.45, 0.1))
	if pixel_font:
		name_lbl.add_theme_font_override("font", pixel_font)
	bvbox.add_child(name_lbl)

	# Dialogue text
	var text_lbl := RichTextLabel.new()
	text_lbl.bbcode_enabled = true
	text_lbl.text = _text
	text_lbl.fit_content = true
	text_lbl.scroll_active = false
	text_lbl.custom_minimum_size = Vector2(BUBBLE_MAX_W, 0)
	text_lbl.add_theme_font_size_override("normal_font_size", ThemeManager.FONT_SIZES["small"])
	if pixel_font:
		text_lbl.add_theme_font_override("normal_font", pixel_font)
	var empty := StyleBoxFlat.new()
	empty.bg_color = Color(0, 0, 0, 0)
	empty.set_border_width_all(0)
	empty.set_content_margin_all(0)
	text_lbl.add_theme_stylebox_override("normal", empty)
	bvbox.add_child(text_lbl)

	# Typewriter effect
	text_lbl.visible_ratio = 0.0
	var tw := create_tween()
	var char_count: int = _text.length()
	var duration := clampf(char_count * 0.02, 0.3, 2.0)
	tw.tween_property(text_lbl, "visible_ratio", 1.0, duration)

	# Size the click area to wrap content
	click_area.custom_minimum_size = Vector2(SPRITE_SIZE + BUBBLE_MAX_W + 16, SPRITE_SIZE + 8)
	click_area.size = click_area.custom_minimum_size


func _load_sprite(key: String) -> Texture2D:
	var path := NPC_SPRITE_DIR + key + ".png"
	if ResourceLoader.exists(path):
		return load(path)
	# Fallback to idle
	var fallback := NPC_SPRITE_DIR + "dio_idle.png"
	if ResourceLoader.exists(fallback):
		return load(fallback)
	return null


# ── Entrance / Exit Animations ─────────────────────────────────────────────

func _animate_entrance() -> void:
	if not _container:
		return

	var start_pos: Vector2
	var end_pos: Vector2

	match _entrance:
		"slide_left":
			start_pos = Vector2(-200, 140)
			end_pos = Vector2(8, 140)
		"slide_right":
			start_pos = Vector2(640, 140)
			end_pos = Vector2(640 - SPRITE_SIZE - BUBBLE_MAX_W - 24, 140)
		"pop_bottom":
			start_pos = Vector2(200, 370)
			end_pos = Vector2(200, 260)
		"peek_left":
			start_pos = Vector2(-180, 100)
			end_pos = Vector2(-30, 100)
		"peek_right":
			start_pos = Vector2(650, 100)
			end_pos = Vector2(640 - SPRITE_SIZE - 40, 100)
		_:
			start_pos = Vector2(-200, 140)
			end_pos = Vector2(8, 140)

	_exit_pos = start_pos
	_container.position = start_pos
	_container.modulate.a = 0.0

	_tween = create_tween()
	_tween.set_ease(Tween.EASE_OUT)
	_tween.set_trans(Tween.TRANS_BACK)
	_tween.tween_property(_container, "position", end_pos, ENTER_DURATION)
	_tween.parallel().tween_property(_container, "modulate:a", 1.0, ENTER_DURATION * 0.6)


func _animate_exit() -> void:
	if _dismissing:
		return
	_dismissing = true
	if _tween and _tween.is_running():
		_tween.kill()

	_tween = create_tween()
	_tween.set_ease(Tween.EASE_IN)
	_tween.set_trans(Tween.TRANS_QUAD)
	_tween.tween_property(_container, "position", _exit_pos, EXIT_DURATION)
	_tween.parallel().tween_property(_container, "modulate:a", 0.0, EXIT_DURATION)
	_tween.tween_callback(queue_free)


# ── SFX ─────────────────────────────────────────────────────────────────────

static func _load_stingers() -> void:
	if _stingers_loaded:
		return
	_stingers_loaded = true
	for i in range(1, 4):
		var path := "res://assets/audio/sfx/dio-stinger-%d.wav" % i
		if ResourceLoader.exists(path):
			_stinger_pool.append(load(path))
	# Fallback to epic loot SFX
	if _stinger_pool.is_empty():
		var fallback := "res://assets/audio/sfx/9.ogg"
		if ResourceLoader.exists(fallback):
			_stinger_pool.append(load(fallback))


func _play_stinger() -> void:
	if _stinger_pool.is_empty():
		return
	var sfx_mgr := get_node_or_null("/root/SfxManager")
	if sfx_mgr:
		var stinger: AudioStream = _stinger_pool[randi() % _stinger_pool.size()]
		sfx_mgr.play_sfx(stinger, -4.0)


# ── Input ────────────────────────────────────────────────────────────────────

func _on_click(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		_dismiss()


func _dismiss() -> void:
	_animate_exit()
