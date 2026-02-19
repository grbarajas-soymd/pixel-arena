extends CanvasLayer
## Self-contained gear inspection popup — builds all UI in code.
## Shows rolled gear with quality badge, stat ranges, affixes, and comparison.

signal gear_equipped(gear: Dictionary)
signal gear_stashed(gear: Dictionary)
signal gear_salvaged(gear: Dictionary, dust: int)
signal dismissed

var _current_gear: Dictionary = {}
var _current_slot: String = ""
var _idb: Node
var _gs: Node
var _card: PanelContainer


func _ready() -> void:
	_idb = get_node_or_null("/root/ItemDatabase")
	_gs = get_node_or_null("/root/GameState")


func show_drop(gear_instance: Dictionary, show_buttons: bool = true) -> void:
	if not _idb:
		return
	_current_gear = gear_instance
	var tmpl = _idb.get_template(gear_instance.get("base_key", ""))
	if tmpl.is_empty():
		return
	_current_slot = tmpl.get("slot", "weapon")
	_build_ui(gear_instance, tmpl, show_buttons)


func _build_ui(gear: Dictionary, tmpl: Dictionary, show_buttons: bool) -> void:
	# Clear previous
	for child in get_children():
		child.queue_free()

	var rarity: String = tmpl.get("rarity", "common")
	var rarity_col: String = _idb.get_rarity_color(rarity)
	var quality: int = int(gear.get("quality", 50))

	# Dim backdrop
	var backdrop := ColorRect.new()
	backdrop.color = Color(rarity_col, 0.15)
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(backdrop)
	backdrop.gui_input.connect(func(ev: InputEvent):
		if ev is InputEventMouseButton and ev.pressed:
			dismissed.emit()
			queue_free()
	)

	# Card panel
	_card = PanelContainer.new()
	_card.position = Vector2(130, 40)
	_card.custom_minimum_size = Vector2(380, 0)
	backdrop.add_child(_card)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 2)
	_card.add_child(vbox)

	# ── Header: icon + name/rarity/quality ──
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 6)
	vbox.add_child(header)

	# Icon with rarity border
	var icon_frame := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.1, 0.1, 0.1)
	sb.border_color = Color(rarity_col)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(2)
	sb.set_content_margin_all(2)
	icon_frame.add_theme_stylebox_override("panel", sb)
	header.add_child(icon_frame)

	var icon_tex: Texture2D = IconMap.get_item_icon(gear.get("base_key", ""))
	if icon_tex:
		var icon_rect := TextureRect.new()
		icon_rect.texture = icon_tex
		icon_rect.custom_minimum_size = Vector2(48, 48)
		icon_rect.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
		icon_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		icon_frame.add_child(icon_rect)

	var info_col := VBoxContainer.new()
	info_col.add_theme_constant_override("separation", 1)
	info_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(info_col)

	var name_lbl := Label.new()
	name_lbl.text = tmpl.get("name", "Unknown")
	name_lbl.add_theme_font_size_override("font_size", 9)
	name_lbl.add_theme_color_override("font_color", Color(rarity_col))
	info_col.add_child(name_lbl)

	var rarity_row := HBoxContainer.new()
	rarity_row.add_theme_constant_override("separation", 6)
	info_col.add_child(rarity_row)
	var rar_lbl := Label.new()
	rar_lbl.text = rarity.to_upper()
	rar_lbl.add_theme_font_size_override("font_size", 7)
	rar_lbl.add_theme_color_override("font_color", Color(rarity_col))
	rarity_row.add_child(rar_lbl)
	var slot_lbl := Label.new()
	slot_lbl.text = tmpl.get("slot", "")
	slot_lbl.add_theme_font_size_override("font_size", 7)
	slot_lbl.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6))
	rarity_row.add_child(slot_lbl)

	# Quality
	var q_col := _quality_color(quality)
	var q_text := _quality_text(quality)
	var q_lbl := Label.new()
	q_lbl.text = str(quality) + "% " + q_text
	q_lbl.add_theme_font_size_override("font_size", 7)
	q_lbl.add_theme_color_override("font_color", Color(q_col))
	info_col.add_child(q_lbl)

	# ── Stats section ──
	vbox.add_child(HSeparator.new())
	var stat_ranges: Dictionary = _idb.get_stat_ranges(gear)
	var rolled_stats: Dictionary = gear.get("stats", {})
	var stats_box := VBoxContainer.new()
	stats_box.add_theme_constant_override("separation", 1)
	vbox.add_child(stats_box)

	for stat_key in rolled_stats:
		var row := _build_stat_row(stat_key, rolled_stats[stat_key], stat_ranges.get(stat_key, {}))
		stats_box.add_child(row)

	# ── Affixes section ──
	var affixes: Array = gear.get("affixes", [])
	if not affixes.is_empty():
		vbox.add_child(HSeparator.new())
		var affix_header := Label.new()
		affix_header.text = "AFFIXES"
		affix_header.add_theme_font_size_override("font_size", 7)
		affix_header.add_theme_color_override("font_color", Color("#ffd700"))
		vbox.add_child(affix_header)
		for affix in affixes:
			var a_row := _build_affix_row(affix)
			vbox.add_child(a_row)

	# ── Comparison ──
	vbox.add_child(HSeparator.new())
	var compare := RichTextLabel.new()
	compare.bbcode_enabled = true
	compare.fit_content = true
	compare.scroll_active = false
	compare.add_theme_font_size_override("normal_font_size", 7)
	compare.custom_minimum_size = Vector2(0, 12)
	vbox.add_child(compare)
	_build_comparison(compare, gear)

	# ── Buttons ──
	if show_buttons:
		var btn_row := HBoxContainer.new()
		btn_row.add_theme_constant_override("separation", 4)
		btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
		vbox.add_child(btn_row)

		var equip_btn := Button.new()
		equip_btn.text = "Equip"
		equip_btn.add_theme_font_size_override("font_size", 8)
		equip_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		ThemeManager.style_stone_button(equip_btn, ThemeManager.COLOR_SUCCESS_GREEN)
		equip_btn.pressed.connect(func():
			gear_equipped.emit(_current_gear)
			queue_free()
		)
		btn_row.add_child(equip_btn)

		var stash_btn := Button.new()
		stash_btn.text = "Stash"
		stash_btn.add_theme_font_size_override("font_size", 8)
		stash_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		ThemeManager.style_stone_button(stash_btn)
		stash_btn.pressed.connect(func():
			gear_stashed.emit(_current_gear)
			queue_free()
		)
		btn_row.add_child(stash_btn)

		var dust_val := _idb.get_salvage_value(gear)
		if dust_val > 0:
			var salv_btn := Button.new()
			salv_btn.text = "Salvage (" + str(dust_val) + ")"
			salv_btn.add_theme_font_size_override("font_size", 8)
			salv_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			ThemeManager.style_stone_button(salv_btn, ThemeManager.COLOR_ACCENT_TEAL)
			salv_btn.pressed.connect(func():
				gear_salvaged.emit(_current_gear, dust_val)
				queue_free()
			)
			btn_row.add_child(salv_btn)

	# Slam animation
	_card.pivot_offset = _card.size / 2.0
	_card.scale = Vector2(2.5, 2.5)
	_card.modulate.a = 0.0
	var tw := create_tween()
	tw.set_ease(Tween.EASE_OUT)
	tw.set_trans(Tween.TRANS_BACK)
	tw.tween_property(_card, "scale", Vector2.ONE, 0.4)
	tw.parallel().tween_property(_card, "modulate:a", 1.0, 0.2)

	# Dio popup for extreme quality rolls
	var q: int = int(gear.get("quality", 50))
	if q >= 95 or q <= 10:
		get_tree().create_timer(0.8).timeout.connect(func():
			var ctx := "perfect_gear" if q >= 95 else "trash_gear"
			DioPopup.spawn(get_tree().root, ctx, q)
		)


func _build_stat_row(stat_key: String, val, range_info: Dictionary) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 4)

	var label := Label.new()
	label.text = _idb.STAT_LABELS.get(stat_key, stat_key) + ":"
	label.add_theme_font_size_override("font_size", 7)
	label.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6))
	label.custom_minimum_size = Vector2(36, 0)
	row.add_child(label)

	var pct: float = float(range_info.get("percentile", 50.0))
	var val_lbl := Label.new()
	val_lbl.text = _fmt(stat_key, val)
	val_lbl.add_theme_font_size_override("font_size", 7)
	val_lbl.add_theme_color_override("font_color", Color(_pct_color(pct)))
	val_lbl.custom_minimum_size = Vector2(40, 0)
	row.add_child(val_lbl)

	if not range_info.is_empty():
		var range_lbl := Label.new()
		range_lbl.text = "[" + _fmt(stat_key, range_info.get("min", 0)) + "-" + _fmt(stat_key, range_info.get("max", 0)) + "]"
		range_lbl.add_theme_font_size_override("font_size", 6)
		range_lbl.add_theme_color_override("font_color", Color(0.4, 0.4, 0.4))
		row.add_child(range_lbl)

		# Tiny percentile bar
		var bar_bg := ColorRect.new()
		bar_bg.custom_minimum_size = Vector2(36, 4)
		bar_bg.color = Color(0.15, 0.15, 0.15)
		row.add_child(bar_bg)
		var bar_fill := ColorRect.new()
		bar_fill.custom_minimum_size = Vector2(maxf(1.0, 36.0 * pct / 100.0), 4)
		bar_fill.color = Color(_pct_color(pct))
		bar_fill.position = Vector2.ZERO
		bar_bg.add_child(bar_fill)

	return row


func _build_affix_row(affix: Dictionary) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 4)

	var pct: float = float(affix.get("percentile", 50.0))
	var name_lbl := Label.new()
	name_lbl.text = str(affix.get("name", "")) + ":"
	name_lbl.add_theme_font_size_override("font_size", 7)
	name_lbl.add_theme_color_override("font_color", Color(_pct_color(pct)))
	name_lbl.custom_minimum_size = Vector2(70, 0)
	row.add_child(name_lbl)

	var desc_lbl := Label.new()
	desc_lbl.text = str(affix.get("desc", ""))
	desc_lbl.add_theme_font_size_override("font_size", 7)
	desc_lbl.add_theme_color_override("font_color", Color(_pct_color(pct)))
	row.add_child(desc_lbl)

	if affix.has("min") and affix.has("max"):
		var is_pct: bool = affix.get("pct", false)
		var min_s: String = str(roundi(float(affix["min"]) * 100.0)) + "%" if is_pct else str(roundi(float(affix["min"])))
		var max_s: String = str(roundi(float(affix["max"]) * 100.0)) + "%" if is_pct else str(roundi(float(affix["max"])))
		var range_lbl := Label.new()
		range_lbl.text = "[" + min_s + "-" + max_s + "]"
		range_lbl.add_theme_font_size_override("font_size", 6)
		range_lbl.add_theme_color_override("font_color", Color(0.4, 0.4, 0.4))
		row.add_child(range_lbl)

	return row


func _build_comparison(rtl: RichTextLabel, gear: Dictionary) -> void:
	var current_equip = _gs.equipment.get(_current_slot, {}) if _gs else {}
	if current_equip.is_empty():
		rtl.text = "[color=#44ff88]Empty " + _current_slot + " slot[/color]"
		return
	var cur_tmpl = _idb.get_template(current_equip.get("base_key", ""))
	if cur_tmpl.is_empty():
		return
	var cur_col := _idb.get_rarity_color(cur_tmpl.get("rarity", "common"))
	var drop_stats: Dictionary = gear.get("stats", {})
	var cur_stats: Dictionary = current_equip.get("stats", {})
	var diffs: Array[String] = []
	var all_keys: Dictionary = {}
	for k in drop_stats:
		all_keys[k] = true
	for k in cur_stats:
		all_keys[k] = true
	for k in all_keys:
		var nv := float(drop_stats.get(k, 0))
		var cv := float(cur_stats.get(k, 0))
		var diff := nv - cv
		if absf(diff) > 0.001:
			var dl := _idb.STAT_LABELS.get(k, k)
			if diff > 0:
				diffs.append("[color=#44ff88]+" + str(snapped(diff, 0.01)) + " " + dl + "[/color]")
			else:
				diffs.append("[color=#ff4444]" + str(snapped(diff, 0.01)) + " " + dl + "[/color]")
	rtl.text = "vs [color=" + cur_col + "]" + str(cur_tmpl.get("name", "")) + "[/color]: "
	if not diffs.is_empty():
		rtl.text += ", ".join(diffs)
	else:
		rtl.text += "[color=#888888]no change[/color]"


func _fmt(stat_key: String, val) -> String:
	if _idb and stat_key in _idb.PCT_STATS:
		return str(roundi(float(val) * 100.0)) + "%"
	elif _idb and stat_key in _idb.DECIMAL_STATS:
		return str(snapped(float(val), 0.01))
	else:
		return str(roundi(float(val)))


func _pct_color(pct: float) -> String:
	if pct >= 90.0:
		return "#ffd700"
	elif pct >= 70.0:
		return "#44ff88"
	elif pct >= 40.0:
		return "#ffffff"
	return "#888888"


func _quality_color(q: int) -> String:
	if q >= 95:
		return "#ffd700"
	elif q >= 80:
		return "#44ff88"
	elif q >= 60:
		return "#44ddbb"
	elif q >= 40:
		return "#ffffff"
	return "#888888"


func _quality_text(q: int) -> String:
	if q >= 95:
		return "Perfect"
	elif q >= 80:
		return "Excellent"
	elif q >= 60:
		return "Good"
	elif q >= 40:
		return "Average"
	return "Poor"
