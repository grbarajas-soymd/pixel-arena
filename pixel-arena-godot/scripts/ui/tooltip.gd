extends PanelContainer
## Tooltip popup for gear, skills, and followers.
## Attach to a CanvasLayer so it renders above everything.

@onready var title_label: Label = %TitleLabel
@onready var rarity_label: Label = %RarityLabel
@onready var desc_label: Label = %DescLabel
@onready var stats_label: Label = %StatsLabel

var _idb: Node
var _fdb: Node


func _ready() -> void:
	hide()
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_idb = get_node_or_null("/root/ItemDatabase")
	_fdb = get_node_or_null("/root/FollowerDatabase")


func show_gear_tooltip(gear_entry: Dictionary, global_pos: Vector2) -> void:
	if not _idb:
		return
	var tmpl = _idb.get_template(gear_entry.get("base_key", ""))
	if tmpl.is_empty():
		hide()
		return

	title_label.text = tmpl.get("name", "Unknown")
	rarity_label.text = tmpl.get("rarity", "common").to_upper()
	rarity_label.modulate = Color(_idb.get_rarity_color(tmpl.get("rarity", "common")))

	var resolved = _idb.resolve_gear(gear_entry)
	if resolved.has("desc"):
		desc_label.text = resolved["desc"]
	else:
		desc_label.text = ""

	var quality = int(resolved.get("quality", 50))
	if quality >= 95:
		stats_label.text = "PERFECT ROLL!"
		stats_label.modulate = Color("#ffd700")
	elif quality >= 80:
		stats_label.text = "Excellent (" + str(quality) + "%)"
		stats_label.modulate = Color("#44ff88")
	elif quality >= 60:
		stats_label.text = "Good (" + str(quality) + "%)"
		stats_label.modulate = Color("#44ddbb")
	else:
		stats_label.text = "Quality: " + str(quality) + "%"
		stats_label.modulate = Color("#aaaaaa")

	global_position = global_pos + Vector2(12, 12)
	_clamp_to_screen()
	show()


func show_skill_tooltip(skill: Dictionary, global_pos: Vector2) -> void:
	title_label.text = skill.get("icon", "") + " " + skill.get("name", "")
	rarity_label.text = skill.get("source", "")
	rarity_label.modulate = Color.WHITE
	desc_label.text = skill.get("desc", "")
	stats_label.text = ""
	global_position = global_pos + Vector2(12, 12)
	_clamp_to_screen()
	show()


func show_follower_tooltip(follower: Dictionary, global_pos: Vector2) -> void:
	if not _fdb:
		return
	var tmpl = _fdb.get_template(follower.get("template_name", ""))
	title_label.text = tmpl.get("icon", "") + " " + tmpl.get("name", "Unknown")
	rarity_label.text = tmpl.get("rarity", "common").to_upper()
	rarity_label.modulate = Color(_fdb.get_rarity_color(tmpl.get("rarity", "common")))
	desc_label.text = tmpl.get("ability_name", "") + ": " + tmpl.get("ability_desc", "")

	var upgrades = int(follower.get("upgrades", 0))
	if upgrades > 0:
		stats_label.text = "+" + str(upgrades) + " Upgraded"
		stats_label.modulate = Color("#ffd700")
	else:
		stats_label.text = tmpl.get("buff_desc", "")
		stats_label.modulate = Color("#aaaaaa")

	global_position = global_pos + Vector2(12, 12)
	_clamp_to_screen()
	show()


func dismiss() -> void:
	hide()


func _clamp_to_screen() -> void:
	var vp_size = get_viewport_rect().size
	if global_position.x + size.x > vp_size.x:
		global_position.x = vp_size.x - size.x - 4
	if global_position.y + size.y > vp_size.y:
		global_position.y = vp_size.y - size.y - 4
