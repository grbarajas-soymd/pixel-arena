extends Node
## Global theme — dark fantasy navy/gold aesthetic with Somdie Mono pixel font.

# === Navy/Gold Dark Fantasy Palette ===
const COLOR_BG_DARK := Color(0.102, 0.102, 0.180)       # #1a1a2e - main background
const COLOR_BG_PANEL := Color(0.145, 0.145, 0.251)       # #252540 - panel interiors
const COLOR_BG_INSET := Color(0.082, 0.082, 0.165)       # #15152a - inset areas
const COLOR_BORDER_GOLD := Color(0.784, 0.659, 0.392)    # #c8a864 - primary borders
const COLOR_BORDER_DIM := Color(0.541, 0.478, 0.314)     # #8a7a50 - secondary borders
const COLOR_TEXT_LIGHT := Color(0.910, 0.831, 0.659)      # #e8d4a8 - primary text
const COLOR_TEXT_DIM := Color(0.604, 0.541, 0.416)        # #9a8a6a - secondary text
const COLOR_TEXT_WHITE := Color(0.941, 0.910, 0.816)      # #f0e8d0 - emphasis text
const COLOR_GOLD_BRIGHT := Color(1.0, 0.855, 0.400)      # #ffda66 - titles/headers
const COLOR_ACCENT_TEAL := Color(0.306, 0.804, 0.769)    # #4ecdc4 - highlights
const COLOR_HP_GREEN := Color(0.290, 0.541, 0.290)       # #4a8a4a - player HP
const COLOR_HP_RED := Color(0.753, 0.251, 0.251)         # #c04040 - enemy HP
const COLOR_MANA_BLUE := Color(0.251, 0.376, 0.753)      # #4060c0 - mana bars
const COLOR_ERROR_RED := Color(0.8, 0.3, 0.3)
const COLOR_SUCCESS_GREEN := Color(0.3, 0.85, 0.3)
const COLOR_OVERLAY_DIM := Color(0.0, 0.0, 0.0, 0.6)

## Font size hierarchy for 960x540 viewport with Somdie Mono.
const FONT_SIZES: Dictionary = {
	"main_title": 24,
	"title": 18,
	"icon": 15,
	"heading": 14,
	"body": 12,
	"small": 11,
}

## Rarity colors — matches items.json _rarity_colors.
const RARITY_COLORS: Dictionary = {
	"starter": Color(0.416, 0.416, 0.353),
	"common": Color(0.541, 0.541, 0.478),
	"uncommon": Color(0.290, 0.541, 0.290),
	"rare": Color(0.290, 0.416, 0.604),
	"epic": Color(0.541, 0.290, 0.604),
	"legendary": Color(0.784, 0.659, 0.282),
	"mythic": Color(0.800, 0.200, 0.200),
}

## Rarity hex strings for BBCode usage.
const RARITY_HEX: Dictionary = {
	"starter": "#6a6a5a",
	"common": "#8a8a7a",
	"uncommon": "#4a8a4a",
	"rare": "#4a6a9a",
	"epic": "#8a4a9a",
	"legendary": "#c8a848",
	"mythic": "#cc3333",
}

## Class colors — matches classes.json.
const CLASS_COLORS: Dictionary = {
	"wizard": Color(0.267, 0.867, 0.733),
	"ranger": Color(1.0, 0.667, 0.267),
	"assassin": Color(0.400, 0.800, 1.0),
	"barbarian": Color(0.800, 0.267, 0.267),
}

var pixel_font: Font = null

func _ready() -> void:
	var theme = Theme.new()

	# -- Load Somdie Mono (custom 5x7 monospace pixel font, default for all UI) --
	pixel_font = load("res://assets/fonts/somdie_mono.ttf")
	if pixel_font:
		theme.default_font = pixel_font
	theme.default_font_size = FONT_SIZES["body"]

	# -- Set font for all common control types --
	var control_types := ["Label", "Button", "RichTextLabel", "LineEdit",
		"OptionButton", "CheckButton", "CheckBox", "TabBar", "MenuBar",
		"ItemList", "Tree", "PopupMenu", "SpinBox", "TextEdit"]
	for ct in control_types:
		if pixel_font:
			theme.set_font("font", ct, pixel_font)
		theme.set_font_size("font_size", ct, FONT_SIZES["body"])

	# -- Default font colors --
	theme.set_color("font_color", "Label", COLOR_TEXT_LIGHT)
	theme.set_color("font_color", "Button", COLOR_TEXT_LIGHT)
	theme.set_color("font_hover_color", "Button", COLOR_GOLD_BRIGHT)
	theme.set_color("font_pressed_color", "Button", COLOR_TEXT_WHITE)
	theme.set_color("font_disabled_color", "Button", COLOR_TEXT_DIM)
	theme.set_color("default_color", "RichTextLabel", COLOR_TEXT_LIGHT)
	theme.set_color("font_color", "LineEdit", COLOR_TEXT_LIGHT)
	theme.set_color("font_placeholder_color", "LineEdit", COLOR_TEXT_DIM)

	# -- Button styles (navy bg, gold border) --
	var btn_normal = StyleBoxFlat.new()
	btn_normal.bg_color = COLOR_BG_PANEL
	btn_normal.border_color = COLOR_BORDER_GOLD
	btn_normal.set_border_width_all(1)
	btn_normal.set_corner_radius_all(0)
	btn_normal.content_margin_left = 4
	btn_normal.content_margin_right = 4
	btn_normal.content_margin_top = 2
	btn_normal.content_margin_bottom = 2
	theme.set_stylebox("normal", "Button", btn_normal)

	var btn_hover = btn_normal.duplicate()
	btn_hover.bg_color = Color(0.20, 0.20, 0.33)
	btn_hover.border_color = COLOR_GOLD_BRIGHT
	theme.set_stylebox("hover", "Button", btn_hover)

	var btn_pressed = btn_normal.duplicate()
	btn_pressed.bg_color = Color(0.10, 0.10, 0.20)
	btn_pressed.border_color = COLOR_GOLD_BRIGHT
	theme.set_stylebox("pressed", "Button", btn_pressed)

	var btn_disabled = btn_normal.duplicate()
	btn_disabled.bg_color = Color(0.12, 0.12, 0.20)
	btn_disabled.border_color = COLOR_BORDER_DIM
	theme.set_stylebox("disabled", "Button", btn_disabled)

	var btn_focus = StyleBoxFlat.new()
	btn_focus.bg_color = Color(0, 0, 0, 0)
	btn_focus.border_color = COLOR_GOLD_BRIGHT
	btn_focus.set_border_width_all(1)
	btn_focus.set_corner_radius_all(0)
	theme.set_stylebox("focus", "Button", btn_focus)

	# -- LineEdit styles --
	var le_normal = StyleBoxFlat.new()
	le_normal.bg_color = COLOR_BG_INSET
	le_normal.border_color = COLOR_BORDER_GOLD
	le_normal.set_border_width_all(1)
	le_normal.set_corner_radius_all(0)
	le_normal.content_margin_left = 4
	le_normal.content_margin_right = 4
	le_normal.content_margin_top = 2
	le_normal.content_margin_bottom = 2
	theme.set_stylebox("normal", "LineEdit", le_normal)

	var le_focus = le_normal.duplicate()
	le_focus.border_color = COLOR_GOLD_BRIGHT
	theme.set_stylebox("focus", "LineEdit", le_focus)

	# -- PanelContainer --
	var panel = StyleBoxFlat.new()
	panel.bg_color = Color(COLOR_BG_PANEL.r, COLOR_BG_PANEL.g, COLOR_BG_PANEL.b, 0.9)
	panel.border_color = COLOR_BORDER_GOLD
	panel.set_border_width_all(1)
	panel.set_corner_radius_all(0)
	panel.set_content_margin_all(4)
	theme.set_stylebox("panel", "PanelContainer", panel)

	# -- ProgressBar --
	var pb_bg = StyleBoxFlat.new()
	pb_bg.bg_color = COLOR_BG_INSET
	pb_bg.border_color = COLOR_BORDER_DIM
	pb_bg.set_border_width_all(1)
	pb_bg.set_corner_radius_all(0)
	theme.set_stylebox("background", "ProgressBar", pb_bg)

	var pb_fill = StyleBoxFlat.new()
	pb_fill.bg_color = COLOR_HP_GREEN
	pb_fill.set_corner_radius_all(0)
	theme.set_stylebox("fill", "ProgressBar", pb_fill)

	# -- RichTextLabel --
	var rtl_bg = StyleBoxFlat.new()
	rtl_bg.bg_color = Color(COLOR_BG_INSET.r, COLOR_BG_INSET.g, COLOR_BG_INSET.b, 0.85)
	rtl_bg.border_color = COLOR_BORDER_DIM
	rtl_bg.set_border_width_all(1)
	rtl_bg.set_content_margin_all(3)
	theme.set_stylebox("normal", "RichTextLabel", rtl_bg)

	# -- TooltipPanel --
	var tt_panel = StyleBoxFlat.new()
	tt_panel.bg_color = Color(COLOR_BG_PANEL.r, COLOR_BG_PANEL.g, COLOR_BG_PANEL.b, 0.95)
	tt_panel.border_color = COLOR_BORDER_GOLD
	tt_panel.set_border_width_all(1)
	tt_panel.set_corner_radius_all(0)
	tt_panel.set_content_margin_all(3)
	theme.set_stylebox("panel", "TooltipPanel", tt_panel)
	if pixel_font:
		theme.set_font("font", "TooltipLabel", pixel_font)
	theme.set_font_size("font_size", "TooltipLabel", FONT_SIZES["small"])
	theme.set_color("font_color", "TooltipLabel", COLOR_TEXT_LIGHT)

	# -- ScrollContainer --
	var scroll_bg = StyleBoxFlat.new()
	scroll_bg.bg_color = Color(COLOR_BG_INSET.r, COLOR_BG_INSET.g, COLOR_BG_INSET.b, 0.5)
	theme.set_stylebox("panel", "ScrollContainer", scroll_bg)

	get_tree().root.theme = theme


# ── Factory Methods ──────────────────────────────────────────────────

## Standard panel StyleBox (navy bg, gold border).
## Always returns StyleBoxFlat — callers modify .border_color, .bg_color etc.
## Texture panels are only used for the global theme default (not factory methods).
static func make_panel_style(alpha: float = 0.95) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = Color(COLOR_BG_PANEL.r, COLOR_BG_PANEL.g, COLOR_BG_PANEL.b, alpha)
	s.border_color = COLOR_BORDER_GOLD
	s.set_border_width_all(1)
	s.set_corner_radius_all(0)
	s.set_content_margin_all(4)
	return s


## Inset panel StyleBox (darker navy, dim border).
static func make_inset_style(alpha: float = 0.95) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = Color(COLOR_BG_INSET.r, COLOR_BG_INSET.g, COLOR_BG_INSET.b, alpha)
	s.border_color = COLOR_BORDER_DIM
	s.set_border_width_all(1)
	s.set_corner_radius_all(0)
	s.set_content_margin_all(3)
	return s


## Apply 3D-styled button (gold borders, navy bg, beveled bottom).
static func style_button(btn: Button, border_color: Color = COLOR_BORDER_GOLD) -> void:
	var normal := StyleBoxFlat.new()
	normal.bg_color = COLOR_BG_PANEL
	normal.border_color = border_color
	normal.border_width_left = 1
	normal.border_width_right = 1
	normal.border_width_top = 1
	normal.border_width_bottom = 2
	normal.set_corner_radius_all(0)
	normal.content_margin_left = 6
	normal.content_margin_right = 6
	normal.content_margin_top = 2
	normal.content_margin_bottom = 4

	var hover := normal.duplicate()
	hover.bg_color = Color(0.20, 0.20, 0.33)
	hover.border_color = border_color.lightened(0.2)

	var pressed := normal.duplicate()
	pressed.bg_color = Color(0.10, 0.10, 0.20)
	pressed.border_width_top = 2
	pressed.border_width_bottom = 1
	pressed.content_margin_top = 4
	pressed.content_margin_bottom = 2

	var disabled := normal.duplicate()
	disabled.bg_color = Color(0.12, 0.12, 0.20)
	disabled.border_color = border_color.darkened(0.5)

	btn.add_theme_stylebox_override("normal", normal)
	btn.add_theme_stylebox_override("hover", hover)
	btn.add_theme_stylebox_override("pressed", pressed)
	btn.add_theme_stylebox_override("disabled", disabled)


## Ornate double-border panel for victory/result overlays.
## Returns a StyleBoxFlat with a bright outer border and dim inner border effect.
static func make_ornate_panel_style(accent: Color = COLOR_GOLD_BRIGHT) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = Color(COLOR_BG_PANEL.r * 0.9, COLOR_BG_PANEL.g * 0.9, COLOR_BG_PANEL.b * 0.9, 0.97)
	s.border_color = accent
	s.border_width_left = 2
	s.border_width_right = 2
	s.border_width_top = 2
	s.border_width_bottom = 2
	s.set_corner_radius_all(0)
	s.set_content_margin_all(10)
	# Expand/shadow for depth
	s.shadow_color = Color(0, 0, 0, 0.5)
	s.shadow_size = 3
	return s


## Create a decorative gold separator line (Label with centered ornamental chars).
static func make_separator(accent: Color = COLOR_BORDER_GOLD) -> Label:
	var sep := Label.new()
	sep.text = "~  *  ~"
	sep.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sep.add_theme_font_size_override("font_size", FONT_SIZES["small"])
	sep.add_theme_color_override("font_color", accent)
	return sep


## Create a thin horizontal rule (ColorRect) for visual separation.
static func make_hrule(color: Color = COLOR_BORDER_GOLD, height: float = 1.0) -> ColorRect:
	var rule := ColorRect.new()
	rule.color = color
	rule.custom_minimum_size = Vector2(0, height)
	rule.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return rule


## Compact bordered button for follower/item pickers.
static func make_follower_btn_style(border_color: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = Color(COLOR_BG_INSET.r, COLOR_BG_INSET.g, COLOR_BG_INSET.b, 0.9)
	s.border_color = border_color
	s.set_border_width_all(1)
	s.set_corner_radius_all(0)
	s.content_margin_left = 4
	s.content_margin_right = 4
	s.content_margin_top = 2
	s.content_margin_bottom = 2
	return s


## Create a TextureRect with NEAREST filtering for pixel-crisp icons.
static func make_icon_rect(icon_path: String, icon_size: float = 16.0) -> TextureRect:
	var tex_rect := TextureRect.new()
	var tex = load(icon_path)
	if tex:
		tex_rect.texture = tex
	tex_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	tex_rect.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
	tex_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	tex_rect.custom_minimum_size = Vector2(icon_size, icon_size)
	return tex_rect


## Create an equipment slot panel with icon and rarity-colored border.
static func make_equipment_slot(icon_path: String, rarity_color: Color, slot_size: float = 20.0) -> PanelContainer:
	var pc := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = COLOR_BG_INSET
	style.border_color = rarity_color
	style.set_border_width_all(1)
	style.set_corner_radius_all(0)
	style.set_content_margin_all(2)
	pc.add_theme_stylebox_override("panel", style)
	pc.custom_minimum_size = Vector2(slot_size, slot_size)
	var icon := make_icon_rect(icon_path, slot_size - 4)
	pc.add_child(icon)
	return pc


# ── Helpers ──────────────────────────────────────────────────────────

## Helper to get rarity color by name string.
static func get_rarity_color(rarity: String) -> Color:
	return RARITY_COLORS.get(rarity, Color(0.7, 0.7, 0.6))


## Helper to get rarity hex string for BBCode.
static func get_rarity_hex(rarity: String) -> String:
	return RARITY_HEX.get(rarity, "#b0b098")


## Helper to get class color by key string.
static func get_class_color(class_key: String) -> Color:
	return CLASS_COLORS.get(class_key, Color(0.7, 0.7, 0.6))
