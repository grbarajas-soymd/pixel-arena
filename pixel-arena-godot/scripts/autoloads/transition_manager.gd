extends CanvasLayer
## Screen transition manager — fade and crosshatch overlays between scene changes.

var _rect: ColorRect
var _crosshatch_rect: ColorRect
var _crosshatch_mat: ShaderMaterial
var _tween: Tween
var _transitioning := false


func _ready() -> void:
	layer = 100

	# Standard fade overlay
	_rect = ColorRect.new()
	_rect.color = Color(0, 0, 0, 0)
	_rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_rect)

	# Crosshatch overlay
	_crosshatch_rect = ColorRect.new()
	_crosshatch_rect.color = Color(0, 0, 0, 0)
	_crosshatch_rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_crosshatch_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_crosshatch_rect.visible = false
	var shader := load("res://shaders/crosshatch_fade.gdshader") as Shader
	if shader:
		_crosshatch_mat = ShaderMaterial.new()
		_crosshatch_mat.shader = shader
		_crosshatch_mat.set_shader_parameter("progress", 0.0)
		_crosshatch_mat.set_shader_parameter("cell_size", 8.0)
		_crosshatch_rect.material = _crosshatch_mat
	add_child(_crosshatch_rect)


func fade_to_scene(path: String, duration: float = 0.3) -> void:
	if _transitioning:
		return
	_transitioning = true
	_rect.mouse_filter = Control.MOUSE_FILTER_STOP
	if _tween:
		_tween.kill()
	_tween = create_tween()
	_tween.tween_property(_rect, "color:a", 1.0, duration * 0.5)
	_tween.tween_callback(_change_scene.bind(path))
	_tween.tween_property(_rect, "color:a", 0.0, duration * 0.5)
	_tween.tween_callback(_on_fade_done)


func crosshatch_to_scene(path: String, duration: float = 0.8) -> void:
	if _transitioning or not _crosshatch_mat:
		fade_to_scene(path, duration)
		return
	_transitioning = true
	_crosshatch_rect.visible = true
	_crosshatch_rect.mouse_filter = Control.MOUSE_FILTER_STOP
	_crosshatch_mat.set_shader_parameter("progress", 0.0)
	if _tween:
		_tween.kill()
	_tween = create_tween()
	# Crosshatch in
	_tween.tween_method(_set_crosshatch.bind(), 0.0, 1.0, duration * 0.5)
	_tween.tween_callback(_change_scene.bind(path))
	# Crosshatch out (reverse)
	_tween.tween_method(_set_crosshatch.bind(), 1.0, 0.0, duration * 0.5)
	_tween.tween_callback(_on_crosshatch_done)


func _set_crosshatch(val: float) -> void:
	_crosshatch_mat.set_shader_parameter("progress", val)


func _change_scene(path: String) -> void:
	get_tree().change_scene_to_file(path)


func _on_fade_done() -> void:
	_transitioning = false
	_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE


func _on_crosshatch_done() -> void:
	_transitioning = false
	_crosshatch_rect.visible = false
	_crosshatch_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
