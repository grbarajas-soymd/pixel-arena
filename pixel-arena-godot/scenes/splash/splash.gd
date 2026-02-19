extends Control
## Studio splash screen — shows SoftBaconSoftware logo then crosshatch fades to main menu.

const MAIN_MENU_PATH := "res://scenes/main_menu/main_menu.tscn"
const LOGO_PATH := "res://assets/sprites/generated/ui/softbacon_logo.png"
const FADE_DURATION := 0.8
const LOGO_HOLD := 2.0       # Seconds to display the logo
const FADE_IN_TIME := 0.5    # Logo fade-in duration

@onready var _logo: TextureRect = $Logo
@onready var _overlay: ColorRect = $CrosshatchOverlay
@onready var _skip_label: Label = $SkipLabel

var _shader_mat: ShaderMaterial
var _can_skip := false
var _transitioning := false


func _ready() -> void:
	# Load crosshatch shader onto overlay
	var shader := load("res://shaders/crosshatch_fade.gdshader") as Shader
	_shader_mat = ShaderMaterial.new()
	_shader_mat.shader = shader
	_shader_mat.set_shader_parameter("progress", 0.0)
	_shader_mat.set_shader_parameter("cell_size", 8.0)
	_overlay.material = _shader_mat

	# Load studio logo
	var logo_tex: Texture2D = null
	if ResourceLoader.exists(LOGO_PATH):
		logo_tex = load(LOGO_PATH)

	if logo_tex:
		_logo.texture = logo_tex
	else:
		# Fallback: text label if logo not generated yet
		_logo.visible = false
		var fallback := Label.new()
		fallback.text = "SoftBacon Software"
		fallback.add_theme_font_size_override("font_size", 24)
		fallback.add_theme_color_override("font_color", Color(1.0, 0.85, 0.5))
		fallback.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		fallback.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		fallback.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
		add_child(fallback)

	# Start music
	var sfx := get_node_or_null("/root/SfxManager")
	if sfx:
		sfx.play_context("menu")

	# Start splash sequence
	_logo.modulate.a = 0.0
	_skip_label.modulate.a = 0.0
	_run_splash()


func _run_splash() -> void:
	var tween := create_tween()

	# Fade in logo
	tween.tween_property(_logo, "modulate:a", 1.0, FADE_IN_TIME)
	tween.tween_callback(func(): _can_skip = true)

	# Show skip hint
	tween.tween_property(_skip_label, "modulate:a", 0.4, 0.3)

	# Hold
	tween.tween_interval(LOGO_HOLD)

	# Crosshatch out
	tween.tween_callback(_start_crosshatch)


func _start_crosshatch() -> void:
	if _transitioning:
		return
	_transitioning = true
	_can_skip = false
	_skip_label.visible = false

	var tween := create_tween()
	tween.tween_method(_set_crosshatch_progress, 0.0, 1.0, FADE_DURATION)
	tween.tween_callback(_go_to_main_menu)


func _set_crosshatch_progress(val: float) -> void:
	_shader_mat.set_shader_parameter("progress", val)


func _go_to_main_menu() -> void:
	get_tree().change_scene_to_file(MAIN_MENU_PATH)


func _unhandled_input(event: InputEvent) -> void:
	if _transitioning:
		return
	if _can_skip and (event is InputEventKey or event is InputEventMouseButton):
		if event.is_pressed():
			_start_crosshatch()
			get_viewport().set_input_as_handled()
