extends CanvasLayer
## Screen transition manager — fade overlay between scene changes.

var _rect: ColorRect
var _tween: Tween
var _transitioning := false


func _ready() -> void:
	layer = 100
	_rect = ColorRect.new()
	_rect.color = Color(0, 0, 0, 0)
	_rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_rect)


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


func _change_scene(path: String) -> void:
	get_tree().change_scene_to_file(path)


func _on_fade_done() -> void:
	_transitioning = false
	_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
