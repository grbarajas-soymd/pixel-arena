extends Node
## Builds combat-ready hero and NPC dictionaries — 1:1 port of src/combat/hero.js
## All mk* functions produce dictionaries with the full ~70 field structure
## expected by CombatEngine's tick loop.

class_name HeroFactory

var _gs: Node
var _classes: Dictionary = {}
var _skills_data: Array = []
var _ults_data: Array = []
var _followers_data: Array = []

const RARITY_COLORS: Dictionary = {
	"common": "#8a8a7a", "uncommon": "#4a8a4a", "rare": "#4a6a9a",
	"epic": "#8a4a9a", "legendary": "#c8a848", "mythic": "#cc3333"
}

## Follower height types: "fly" = high in air, "float" = hovering mid-height, "ground" = on ground
const FOLLOWER_HEIGHT: Dictionary = {
	# Flying — high up next to character
	"Phoenix": "fly",
	"Thunder Hawk": "fly",
	"Flame Drake": "fly",
	"Chaos Dragon": "fly",
	"Void Stalker": "fly",
	# Floating — hovering off ground
	"Ember Sprite": "float",
	"Bone Wraith": "float",
	"Crystal Elemental": "float",
	"Fire Imp": "float",
	"Death Knight": "float",
	# Ground — on the ground (default)
	"Frost Wolf": "ground",
	"Stone Golem": "ground",
	"Shadow Rat": "ground",
	"Mud Crawler": "ground",
	"Iron Beetle": "ground",
	"Venom Spider": "ground",
	"Shadow Panther": "ground",
	"Storm Serpent": "ground",
	"Ancient Treant": "ground",
}

## Y offset from owner for each height type (negative = higher on screen)
const HEIGHT_OFFSETS: Dictionary = {
	"fly": -40.0,
	"float": -18.0,
	"ground": 8.0,
}


func _ready() -> void:
	_gs = get_node("/root/GameState")
	_load_data()


func _load_data() -> void:
	var f := FileAccess.open("res://data/classes.json", FileAccess.READ)
	if f:
		_classes = JSON.parse_string(f.get_as_text())
		f.close()
	var sf := FileAccess.open("res://data/skills.json", FileAccess.READ)
	if sf:
		var sd = JSON.parse_string(sf.get_as_text())
		sf.close()
		if sd is Dictionary:
			_skills_data = sd.get("skills", [])
			_ults_data = sd.get("ultimates", [])
	var ff := FileAccess.open("res://data/followers.json", FileAccess.READ)
	if ff:
		var fd = JSON.parse_string(ff.get_as_text())
		ff.close()
		if fd is Dictionary:
			_followers_data = fd.get("templates", [])


# ============ TOTAL STATS (port of getCustomTotalStats) ============

func get_custom_total_stats() -> Dictionary:
	var s: Dictionary = _gs.custom_char.duplicate(true)
	for slot_name in _gs.equipment:
		var gear = _gs.equipment[slot_name]
		if gear and gear.has("stats"):
			for k in gear.stats:
				s[k] = s.get(k, 0) + gear.stats[k]
	# Follower buff
	if _gs.active_follower >= 0 and _gs.active_follower < _gs.followers.size():
		var fl = _gs.followers[_gs.active_follower]
		var tmpl = _find_follower_template(fl.get("template_name", fl.get("name", "")))
		if not tmpl.is_empty() and tmpl.has("buff"):
			for k in tmpl.buff:
				s[k] = s.get(k, 0) + tmpl.buff[k]
	# Clamp
	s["hp"] = maxi(100, int(s.get("hp", 4000)))
	s["base_dmg"] = maxi(10, int(s.get("base_dmg", 100)))
	s["base_as"] = maxf(0.1, float(s.get("base_as", 0.8)))
	s["def"] = maxi(0, int(s.get("def", 40)))
	s["evasion"] = clampf(float(s.get("evasion", 0.0)), 0.0, 0.8)
	s["move_speed"] = maxi(30, int(s.get("move_speed", 100)))
	return s


func get_weapon_range_type() -> String:
	return _gs.get_weapon_range_type()


## Get weapon visual type and glow color from equipped weapon.
func _get_weapon_visual_info(equip: Dictionary) -> Dictionary:
	var weapon = equip.get("weapon")
	if weapon:
		var idb = get_node_or_null("/root/ItemDatabase")
		if idb:
			var tmpl = idb.get_template(weapon.get("base_key", ""))
			if tmpl:
				var vis = tmpl.get("visual", {})
				return {
					"weapon_visual_type": vis.get("type", "sword"),
					"weapon_glow": vis.get("glow", ""),
				}
	return {"weapon_visual_type": "sword", "weapon_glow": ""}


## Class-default weapon visual types for NPC heroes.
const NPC_WEAPON_VISUALS: Dictionary = {
	"barbarian": "axe",
	"wizard": "staff",
	"ranger": "bow",
	"assassin": "daggers",
}


## Apply weapon visual type to hero dict from equipment or class defaults.
func _apply_weapon_visual(h: Dictionary, equip: Dictionary, class_key: String = "") -> void:
	if not equip.is_empty():
		var info := _get_weapon_visual_info(equip)
		h["weapon_visual_type"] = info["weapon_visual_type"]
		h["weapon_glow"] = info["weapon_glow"]
	elif NPC_WEAPON_VISUALS.has(class_key):
		h["weapon_visual_type"] = NPC_WEAPON_VISUALS[class_key]
		h["weapon_glow"] = ""
	else:
		h["weapon_visual_type"] = "claw"
		h["weapon_glow"] = ""


## Apply hybrid weapon ranges (daggers can be thrown or used in melee).
func _apply_hybrid_ranges(h: Dictionary, range_type: String) -> void:
	if range_type == "hybrid":
		h["attack_range"] = 200
		h["melee_range"] = 70
		h["throw_range"] = 200
		h["preferred_range"] = 80
	elif range_type == "melee":
		h["attack_range"] = 70
		h["preferred_range"] = 50
	else:  # ranged
		h["attack_range"] = 350
		h["preferred_range"] = 300


func _find_follower_template(tmpl_name: String) -> Dictionary:
	for t in _followers_data:
		if t.get("name", "") == tmpl_name:
			return t
	return {}


# ============ SHARED BASE FIELDS ============
# Initializes all status effect, animation, and combat tracking fields
# that every hero/monster needs for the combat engine.

func _base_combat_fields(side: String) -> Dictionary:
	var is_left := side == "left"
	return {
		"side": side,
		"facing": 1 if is_left else -1,
		"atk_cnt": 0, "atk_cd": 0, "bleed_stacks": [],
		"shocked": false, "shocked_end": 0,
		"slow": 0.0, "slow_end": 0,
		"stun_end": 0,
		"state": "idle",
		"bob_phase": 0.0 if is_left else PI,
		"attack_anim": 0.0, "hurt_anim": 0.0, "cast_anim": 0.0,
		"tot_dmg": 0.0, "tot_heal": 0.0,
		# Ranger
		"bl_active": false, "bl_end": 0, "bl_dmg": 0.0, "mark_next": false,
		"follower_alive": false, "follower": {}, "follower_max_hp": 450,
		"arena_followers": [],
		# Ult
		"ult_active": false, "ult_end": 0,
		# Shield
		"shield_active": false, "shield_hp": 0.0, "shield_end": 0,
		# Wizard
		"mana": 0, "max_mana": 0, "mana_regen": 0.0,
		"charge": 0, "max_charge": 10, "charge_decay_timer": 0,
		"cast_speed_bonus": 0.0, "spell_dmg_bonus": 0.0,
		"spell_range": 200,
		"ult_strikes": 0, "ult_strike_timer": 0,
		# Assassin
		"energy": 0, "max_energy": 0, "energy_regen": 0.0,
		"melee_range": CombatConstants.MELEE, "throw_range": 200,
		"stealthed": false, "stealth_end": 0,
		"combo": 0, "max_combo": 5,
		"envenomed": false, "envenomed_end": 0,
		# Death mark
		"death_mark_target": false, "death_mark_end": 0, "death_mark_dmg": 0.0,
		# Smoke bomb
		"smoke_bomb_active": false, "smoke_bomb_end": 0,
		"smoke_bomb_x": 0.0, "smoke_bomb_radius": 120.0,
		# Vulnerable
		"vulnerable": false, "vulnerable_end": 0, "vulnerable_amp": 0.0,
		# Riposte
		"riposte_active": false, "riposte_end": 0, "riposte_dmg": 0.0,
		# Trance
		"trance_active": false, "trance_end": 0, "trance_dmg": 0.0, "trance_def_loss": 0.0,
		# Thorns
		"thorns_active": false, "thorns_end": 0, "thorns_pct": 0.0,
		# Burn
		"burning": false, "burn_end": 0, "burn_dmg": 0.0,
		# Primal
		"primal_active": false, "primal_end": 0,
		# Shadow Dance
		"shadow_dance_active": false, "shadow_dance_end": 0,
		# Last Stand
		"last_stand_active": false, "last_stand_end": 0,
		# Free spells (arcane overload)
		"free_spells_active": false, "free_spells_end": 0,
		# Custom / generic
		"resource": 0, "max_resource": 0, "resource_regen": 0.0,
		"spells": {},
		"custom_skill_ids": [],
		"custom_ult_id": -1,
		# Stash (dungeon items)
		"_stash_crit": 0.0,
		"_stash_lifesteal": 0.0,
		# Gear affix stats
		"_crit_chance": 0.0,
		"_lifesteal": 0.0,
		"_thorns_reflect": 0.0,
		"_hp_regen": 0,
		"_dmg_reduction": 0.0,
		"_fire_dmg": 0.0,
		"_ice_dmg": 0.0,
		"_lightning_dmg": 0.0,
		"_special_affixes": [],
	}


# ============ mkHero — NPC class hero (port of hero.js:41-88) ============

func mk_hero(class_key: String, side: String, ladder_scale: float = 1.0) -> Dictionary:
	if class_key == "custom":
		return mk_custom_hero(side)
	var c: Dictionary = _classes.get(class_key, {})
	if c.is_empty():
		return {}
	var is_left := side == "left"
	var ls := ladder_scale
	var h := _base_combat_fields(side)
	h["type"] = class_key
	h["name"] = c.get("name_short", "NPC")
	h["color"] = c.get("color", "#ffffff")
	h["color_dark"] = c.get("color_dark", "#444444")
	h["color_light"] = c.get("color_light", "#cccccc")
	h["x"] = float(CombatConstants.AX + 140) if is_left else float(CombatConstants.AX + CombatConstants.AW - 140)
	h["y"] = float(CombatConstants.GY)
	h["max_hp"] = roundi(float(c.get("hp", 4000)) * ls)
	h["hp"] = h["max_hp"]
	h["base_dmg"] = roundi(float(c.get("base_dmg", 100)) * ls)
	h["base_as"] = snappedf(float(c.get("base_as", 0.8)) * ls, 0.01)
	h["def"] = roundi(float(c.get("def", 40)) * ls)
	h["evasion"] = float(c.get("evasion", 0.0))
	h["move_speed"] = int(c.get("move_speed", 100))
	h["move_speed_bonus"] = float(c.get("move_speed_bonus", 0.0))
	h["attack_range"] = int(c.get("attack_range", c.get("throw_range", 200)))
	h["preferred_range"] = int(c.get("preferred_range", 200))

	# Class-specific fields
	if class_key == "wizard":
		h["mana"] = int(c.get("mana", 650))
		h["max_mana"] = h["mana"]
		h["mana_regen"] = float(c.get("mana_regen", 5.5))
		h["cast_speed_bonus"] = float(c.get("cast_speed_bonus", 0.12))
		h["spell_dmg_bonus"] = float(c.get("spell_dmg_bonus", 0.08))
		h["spell_range"] = int(c.get("spell_range", c.get("attack_range", 430)))
		h["spells"] = {
			"chain_lightning": {"cd": 0, "bcd": int(c.get("chain_bcd", 5000)), "cost": int(c.get("chain_cost", 35)), "n": "Chain Zap"},
			"lightning_bolt": {"cd": 0, "bcd": int(c.get("bolt_bcd", 2200)), "cost": int(c.get("bolt_cost", 20)), "n": "Bolt"},
			"static_shield": {"cd": 0, "bcd": int(c.get("shield_bcd", 10000)), "cost": int(c.get("shield_cost", 45)), "n": "Shield"},
			"ultimate": {"cd": 0, "bcd": 999999, "used": false, "n": "Storm"},
		}
	elif class_key == "ranger":
		h["follower_max_hp"] = int(c.get("follower_max_hp", 450))
		h["spells"] = {
			"hunters_mark": {"cd": 0, "bcd": 8000, "n": "Mark"},
			"bloodlust": {"cd": 0, "bcd": 12000, "n": "Bloodlust"},
			"sacrifice": {"cd": 0, "bcd": 15000, "n": "Summon"},
			"ultimate": {"cd": 0, "bcd": 999999, "used": false, "n": "Rain of Fire"},
		}
	elif class_key == "assassin":
		h["energy"] = int(c.get("energy", 100))
		h["max_energy"] = h["energy"]
		h["energy_regen"] = float(c.get("energy_regen", 14.0))
		h["melee_range"] = int(c.get("melee_range", CombatConstants.MELEE))
		h["throw_range"] = int(c.get("throw_range", 200))
		h["attack_range"] = h["throw_range"]
		h["spells"] = {
			"shadow_step": {"cd": 0, "bcd": 3500, "cost": 25, "n": "Step"},
			"envenom": {"cd": 0, "bcd": 8000, "cost": 30, "n": "Envenom"},
			"smoke_bomb": {"cd": 0, "bcd": 12000, "cost": 35, "n": "Smoke"},
			"ultimate": {"cd": 0, "bcd": 999999, "used": false, "n": "Death Mark"},
		}
	elif class_key == "barbarian":
		h["spells"] = {
			"charge": {"cd": 0, "bcd": int(c.get("charge_bcd", 5500)), "n": "Charge"},
			"war_cry": {"cd": 0, "bcd": int(c.get("war_cry_bcd", 10000)), "n": "War Cry"},
			"ultimate": {"cd": 0, "bcd": 999999, "used": false, "n": "Berserker"},
		}

	# Weapon visual type for NPC heroes
	_apply_weapon_visual(h, {}, class_key)
	return h


# ============ mkFollower — ranger pet (port of hero.js:90) ============

func mk_follower(owner: Dictionary) -> Dictionary:
	var max_hp := int(owner.get("follower_max_hp", 450))
	return {
		"alive": true,
		"hp": max_hp,
		"max_hp": max_hp,
		"x": float(owner.get("x", 0)) + float(owner.get("facing", 1)) * 40.0,
		"y": float(owner.get("y", CombatConstants.GY)),
		"move_speed": 140,
		"attack_range": CombatConstants.MELEE,
		"goading": true,
		"goad_range": 120,
		"bob_phase": randf() * TAU,
		"hurt_anim": 0.0,
	}


# ============ mkCustomHero — player hero (port of hero.js:92-101) ============

func mk_custom_hero(side: String) -> Dictionary:
	var is_left := side == "left"
	var s := get_custom_total_stats()
	var range_type := get_weapon_range_type()
	var is_melee := range_type == "melee"
	var h := _base_combat_fields(side)
	h["type"] = "custom"
	h["custom_sprite"] = _gs.custom_char.get("class_key", "barbarian")
	h["class_key"] = _gs.custom_char.get("class_key", "barbarian")
	h["name"] = _gs.custom_char.get("name", "Hero")
	h["color"] = "#d8b858"
	h["color_dark"] = "#4a3818"
	h["color_light"] = "#e8d080"
	h["x"] = float(CombatConstants.AX + 140) if is_left else float(CombatConstants.AX + CombatConstants.AW - 140)
	h["y"] = float(CombatConstants.GY)
	h["max_hp"] = int(s.get("hp", 4000))
	h["hp"] = h["max_hp"]
	h["base_dmg"] = int(s.get("base_dmg", 100))
	h["base_as"] = float(s.get("base_as", 0.8))
	h["def"] = int(s.get("def", 40))
	h["evasion"] = float(s.get("evasion", 0.0))
	h["move_speed"] = int(s.get("move_speed", 100))
	h["move_speed_bonus"] = 0.0
	_apply_hybrid_ranges(h, range_type)
	h["mana"] = int(s.get("mana", 0))
	h["max_mana"] = h["mana"]
	h["mana_regen"] = float(s.get("mana_regen", 0.0))
	h["spell_dmg_bonus"] = float(s.get("spell_dmg_bonus", 0.0))
	h["spell_range"] = 200 if is_melee else 400
	h["energy"] = int(s.get("energy", 0))
	h["max_energy"] = h["energy"]
	h["energy_regen"] = float(s.get("energy_regen", 0.0))
	h["resource"] = maxi(maxi(h["mana"], h["energy"]), 100)
	h["max_resource"] = h["resource"]
	h["resource_regen"] = maxf(maxf(float(s.get("mana_regen", 0.0)), float(s.get("energy_regen", 0.0))), 2.0)

	# Gear affix stats
	h["_crit_chance"] = float(s.get("crit_chance", 0.0))
	h["_lifesteal"] = float(s.get("lifesteal", 0.0))
	h["_thorns_reflect"] = float(s.get("thorns_reflect", 0.0))
	h["_hp_regen"] = int(s.get("hp_regen", 0))
	h["_dmg_reduction"] = float(s.get("dmg_reduction", 0.0))
	h["_fire_dmg"] = float(s.get("fire_dmg", 0.0))
	h["_ice_dmg"] = float(s.get("ice_dmg", 0.0))
	h["_lightning_dmg"] = float(s.get("lightning_dmg", 0.0))
	h["_special_affixes"] = _gs.get_special_affixes()

	# Copy equipment for rendering
	h["equipment"] = {}
	for ek in _gs.equipment:
		h["equipment"][ek] = _gs.equipment[ek]

	# Weapon visual type for VFX
	_apply_weapon_visual(h, h["equipment"])

	# Attach skills
	h["spells"] = {}
	h["custom_skill_ids"] = []
	var char_skills: Array = _gs.custom_char.get("skills", [])
	for i in range(mini(2, char_skills.size())):
		var skill_idx = char_skills[i]
		if skill_idx != null and skill_idx >= 0 and skill_idx < _skills_data.size():
			var sk = _skills_data[skill_idx]
			h["spells"]["skill" + str(i)] = {"cd": 0, "bcd": int(sk.get("bcd", 3000)), "n": sk.get("name", "")}
			h["custom_skill_ids"].append({"idx": skill_idx, "key": "skill" + str(i)})

	# Attach ultimate
	var char_ult = _gs.custom_char.get("ultimate", null)
	if char_ult != null and char_ult >= 0 and char_ult < _ults_data.size():
		var ult = _ults_data[char_ult]
		h["spells"]["ultimate"] = {"cd": 0, "bcd": 999999, "used": false, "n": ult.get("name", "")}
		h["custom_ult_id"] = char_ult

	return h


# ============ mkLadderHero — generated ladder opponent (port of hero.js:103-139) ============

func mk_ladder_hero(cfg: Dictionary, side: String) -> Dictionary:
	var is_left: bool = side == "left"
	var range_type: String = cfg.get("range_type", "melee")
	var h := _base_combat_fields(side)
	h["type"] = "custom"
	h["custom_sprite"] = cfg.get("sprite", "")
	h["name"] = cfg.get("name", "Opponent")
	h["color"] = "#d8b858"
	h["color_dark"] = "#4a3818"
	h["color_light"] = "#e8d080"
	h["x"] = float(CombatConstants.AX + 140) if is_left else float(CombatConstants.AX + CombatConstants.AW - 140)
	h["y"] = float(CombatConstants.GY)
	h["max_hp"] = int(cfg.get("hp", 4000))
	h["hp"] = h["max_hp"]
	h["base_dmg"] = int(cfg.get("base_dmg", 100))
	h["base_as"] = float(cfg.get("base_as", 0.8))
	h["def"] = int(cfg.get("def", 40))
	h["evasion"] = float(cfg.get("evasion", 0.0))
	h["move_speed"] = int(cfg.get("move_speed", 100))
	h["move_speed_bonus"] = 0.0
	_apply_hybrid_ranges(h, range_type)
	h["mana"] = 300
	h["max_mana"] = 300
	h["mana_regen"] = 4.0
	h["spell_dmg_bonus"] = 0.0
	h["spell_range"] = 200 if range_type == "melee" else 400
	h["energy"] = 100
	h["max_energy"] = 100
	h["energy_regen"] = 12.0
	h["resource"] = 300
	h["max_resource"] = 300
	h["resource_regen"] = 4.0

	# Copy equipment for rendering
	if cfg.has("equip"):
		h["equipment"] = {}
		for ek in cfg.equip:
			h["equipment"][ek] = cfg.equip[ek]

	# Weapon visual type for VFX
	_apply_weapon_visual(h, h.get("equipment", {}))

	# Attach skills
	h["spells"] = {}
	h["custom_skill_ids"] = []
	var cfg_skills: Array = cfg.get("skills", [])
	for i in range(mini(2, cfg_skills.size())):
		var skill_idx = cfg_skills[i]
		if skill_idx != null and skill_idx >= 0 and skill_idx < _skills_data.size():
			var sk = _skills_data[skill_idx]
			h["spells"]["skill" + str(i)] = {"cd": 0, "bcd": int(sk.get("bcd", 3000)), "n": sk.get("name", "")}
			h["custom_skill_ids"].append({"idx": skill_idx, "key": "skill" + str(i)})

	# Attach ultimate
	var cfg_ult = cfg.get("ultimate", null)
	if cfg_ult != null and cfg_ult >= 0 and cfg_ult < _ults_data.size():
		h["custom_ult_id"] = cfg_ult
		h["spells"]["ultimate"] = {"cd": 0, "used": false}

	return h


# ============ mkDungeonMonster — melee monster (port of hero.js:157-191) ============

func mk_dungeon_monster(m: Dictionary, side: String) -> Dictionary:
	var is_left := side == "left"
	var h := _base_combat_fields(side)
	h["type"] = "custom"
	h["monster_type"] = m.get("monster_type", m.get("type", "humanoid"))
	h["monster_colors"] = m.get("colors", {})
	h["name"] = m.get("name", "Monster")
	h["monster_icon"] = m.get("icon", "")
	h["color"] = "#ff4444"
	h["color_dark"] = "#6a1a1a"
	h["color_light"] = "#ff8888"
	h["x"] = float(CombatConstants.AX + 140) if is_left else float(CombatConstants.AX + CombatConstants.AW - 140)
	h["y"] = float(CombatConstants.GY)
	var tier := int(m.get("tier", 1))
	h["max_hp"] = int(m.get("hp", 500))
	h["hp"] = h["max_hp"]
	h["base_dmg"] = int(m.get("dmg", m.get("base_dmg", 50)))
	h["base_as"] = 0.8 + float(tier - 1) * 0.15
	h["def"] = int(m.get("def", 10))
	h["evasion"] = float(m.get("evasion", 0.0))
	h["move_speed"] = 70 + tier * 10
	h["move_speed_bonus"] = 0.0
	h["attack_range"] = 70
	h["preferred_range"] = 50
	h["weapon_visual_type"] = "claw"
	h["weapon_glow"] = ""
	# Monsters have no spells/resources by default
	h["spells"] = {}
	h["custom_skill_ids"] = []
	h["custom_ult_id"] = -1
	h["resource"] = 0
	h["max_resource"] = 0
	h["resource_regen"] = 0.0
	h["follower_max_hp"] = 0
	return h


# ============ mkDungeonHero — player in dungeon (port of hero.js:193-249) ============

func mk_dungeon_hero(run: Dictionary, side: String) -> Dictionary:
	var is_left := side == "left"
	var s := get_custom_total_stats()
	var range_type := get_weapon_range_type()
	var is_melee := range_type == "melee"
	var h := _base_combat_fields(side)
	h["type"] = "custom"
	h["custom_sprite"] = _gs.custom_char.get("class_key", "barbarian")
	h["class_key"] = _gs.custom_char.get("class_key", "barbarian")
	h["name"] = run.get("hero_name", "Hero")
	h["color"] = "#d8b858"
	h["color_dark"] = "#4a3818"
	h["color_light"] = "#e8d080"
	h["x"] = float(CombatConstants.AX + 140) if is_left else float(CombatConstants.AX + CombatConstants.AW - 140)
	h["y"] = float(CombatConstants.GY)
	h["max_hp"] = int(run.get("max_hp", 4000))
	h["hp"] = int(run.get("hp", h["max_hp"]))
	h["base_dmg"] = int(run.get("base_dmg", 100)) + int(run.get("bonus_dmg", 0))
	h["base_as"] = float(run.get("base_as", 0.8)) + float(run.get("bonus_as", 0.0))
	h["def"] = int(run.get("def", 40)) + int(run.get("bonus_def", 0))
	h["evasion"] = float(run.get("evasion", 0.0))
	h["move_speed"] = int(s.get("move_speed", 100)) + int(run.get("move_speed", 0))
	h["move_speed_bonus"] = 0.0
	_apply_hybrid_ranges(h, range_type)
	h["mana"] = int(run.get("mana", 0))
	h["max_mana"] = int(run.get("max_mana", 0))
	h["mana_regen"] = float(run.get("mana_regen", 0.0))
	h["spell_dmg_bonus"] = float(s.get("spell_dmg_bonus", 0.0))
	h["spell_range"] = 200 if is_melee else 400
	h["energy"] = int(s.get("energy", 0))
	h["max_energy"] = h["energy"]
	h["energy_regen"] = float(s.get("energy_regen", 0.0))
	h["resource"] = maxi(maxi(h["mana"], h["energy"]), 100)
	h["max_resource"] = maxi(maxi(h["max_mana"], h["max_energy"]), 100)
	h["resource_regen"] = maxf(maxf(h["mana_regen"], h["energy_regen"]), 2.0)
	# Dungeon stash bonuses
	h["_stash_crit"] = float(run.get("_crit", 0.0))
	h["_stash_lifesteal"] = float(run.get("_lifesteal", 0.0))

	# Gear affix stats
	h["_crit_chance"] = float(run.get("crit_chance", 0.0))
	h["_lifesteal"] = float(run.get("lifesteal", 0.0))
	h["_thorns_reflect"] = float(run.get("thorns_reflect", 0.0))
	h["_hp_regen"] = int(run.get("hp_regen", 0))
	h["_dmg_reduction"] = float(run.get("dmg_reduction", 0.0))
	h["_fire_dmg"] = float(run.get("fire_dmg", 0.0))
	h["_ice_dmg"] = float(run.get("ice_dmg", 0.0))
	h["_lightning_dmg"] = float(run.get("lightning_dmg", 0.0))
	h["_special_affixes"] = run.get("special_affixes", [])

	# Copy equipment for rendering
	h["equipment"] = {}
	for ek in _gs.equipment:
		h["equipment"][ek] = _gs.equipment[ek]

	# Weapon visual type for VFX
	_apply_weapon_visual(h, h["equipment"])

	# Attach skills from customChar
	h["spells"] = {}
	h["custom_skill_ids"] = []
	var char_skills: Array = _gs.custom_char.get("skills", [])
	for i in range(mini(2, char_skills.size())):
		var skill_idx = char_skills[i]
		if skill_idx != null and skill_idx >= 0 and skill_idx < _skills_data.size():
			var sk = _skills_data[skill_idx]
			h["spells"]["skill" + str(i)] = {"cd": 0, "bcd": int(sk.get("bcd", 3000)), "n": sk.get("name", "")}
			h["custom_skill_ids"].append({"idx": skill_idx, "key": "skill" + str(i)})

	# Attach ultimate
	var char_ult = _gs.custom_char.get("ultimate", null)
	if char_ult != null and char_ult >= 0 and char_ult < _ults_data.size():
		var ult = _ults_data[char_ult]
		h["spells"]["ultimate"] = {"cd": 0, "bcd": 999999, "used": false, "n": ult.get("name", "")}
		h["custom_ult_id"] = char_ult

	return h


# ============ mkArenaFollower — combat follower entity (port of hero.js:251-273) ============

func mk_arena_follower(template: Dictionary, owner: Dictionary, idx: int, total: int) -> Dictionary:
	var is_left: bool = owner.get("side", "left") == "left"
	var spacing := 45.0
	var base_x := float(owner.get("x", 0)) + ((-60.0) if is_left else 60.0)
	var x_jitter := float(idx) * spacing * (-1.0 if is_left else 1.0)
	var combat_range: int = int(template.get("combat_range", 60))
	var rarity: String = str(template.get("rarity", "common"))
	var ms_bonus := 0
	if rarity == "legendary":
		ms_bonus = 30
	elif rarity == "epic":
		ms_bonus = 20
	elif rarity == "rare":
		ms_bonus = 10
	var upgrades := int(template.get("upgrades", 0))
	var up_scale := pow(1.15, float(upgrades))
	# Height-based Y offset: flying creatures high, floating mid, ground level
	var f_name: String = str(template.get("name", "Follower"))
	var height_type: String = FOLLOWER_HEIGHT.get(f_name, "ground")
	var height_y: float = HEIGHT_OFFSETS.get(height_type, 8.0)
	var multi_offset_y := (float(idx) - float(total - 1) / 2.0) * 20.0
	return {
		"alive": true,
		"name": f_name,
		"template_name": f_name,
		"icon": template.get("icon", ""),
		"rarity": rarity,
		"_upgrades": upgrades,
		"height_type": height_type,
		"color": RARITY_COLORS.get(rarity, "#aaa"),
		"hp": roundi(float(template.get("combat_hp", 400)) * up_scale),
		"max_hp": roundi(float(template.get("combat_hp", 400)) * up_scale),
		"base_dmg": roundi(float(template.get("combat_dmg", 30)) * up_scale),
		"base_as": float(template.get("combat_as", 1.0)),
		"def": roundi(float(template.get("combat_def", 10)) * up_scale),
		"attack_range": combat_range,
		"move_speed": 100 + ms_bonus,
		"x": base_x + x_jitter,
		"y": float(CombatConstants.GY) + height_y + multi_offset_y,
		"owner_side": owner.get("side", "left"),
		"bob_phase": randf() * TAU,
		"hurt_anim": 0.0,
		"attack_anim": 0.0,
		"atk_cd": 0.0,
		"tot_dmg": 0.0,
		"is_ranged": combat_range > 100,
		"ability_name": template.get("ability_name", ""),
		"ability_bcd": int(template.get("ability_bcd", 6000)),
		"ability_cd": int(template.get("ability_bcd", 6000)),
		"has_on_death": template.get("has_on_death", false),
		"_buffs": [],
		"_debuffs": [],
		"_reborn": false,
	}


# ============ applyFollowerBuff — stat buffs from equipped follower (port of hero.js:275-287) ============

func apply_follower_buff(hero: Dictionary, follower_data: Dictionary) -> void:
	var buff: Dictionary = follower_data.get("buff", {})
	if buff.is_empty():
		return
	for k in buff:
		if k == "hp":
			hero["max_hp"] = int(hero.get("max_hp", 0)) + int(buff[k])
			hero["hp"] = int(hero.get("hp", 0)) + int(buff[k])
		elif k == "base_dmg":
			hero["base_dmg"] = int(hero.get("base_dmg", 0)) + int(buff[k])
		elif k == "base_as":
			hero["base_as"] = float(hero.get("base_as", 0.0)) + float(buff[k])
		elif k == "def":
			hero["def"] = int(hero.get("def", 0)) + int(buff[k])
		elif k == "evasion":
			hero["evasion"] = minf(0.8, float(hero.get("evasion", 0.0)) + float(buff[k]))
		elif k == "move_speed":
			hero["move_speed"] = int(hero.get("move_speed", 0)) + int(buff[k])
		elif k == "mana":
			hero["max_mana"] = int(hero.get("max_mana", 0)) + int(buff[k])
			hero["mana"] = int(hero.get("mana", 0)) + int(buff[k])


# ============ applyWagerDebuff — debuff from staked follower (port of followers.js wagerDebuff.apply) ============

func apply_wager_debuff(hero: Dictionary, follower_data: Dictionary) -> void:
	var wd: Dictionary = follower_data.get("wager_debuff", {})
	if wd.is_empty():
		return
	var desc: String = wd.get("desc", "")
	# Parse debuff description to apply effects
	# Common patterns: "-X DEF", "-X% AtkSpd", "-X Spd", "-X HP", "-X DMG", etc.
	var tmpl_name: String = follower_data.get("name", "")
	match tmpl_name:
		"Fire Imp":
			hero["def"] = maxi(0, int(hero.get("def", 0)) - 12)
		"Stone Golem":
			hero["base_as"] = float(hero.get("base_as", 0.8)) * 0.85
		"Shadow Rat":
			hero["move_speed"] = maxi(30, int(hero.get("move_speed", 100)) - 10)
		"Ember Sprite":
			hero["shocked"] = true
			hero["shocked_end"] = 999999999
		"Mud Crawler":
			hero["move_speed"] = roundi(float(hero.get("move_speed", 100)) * 0.8)
		"Frost Wolf":
			hero["slow"] = 0.15
			hero["slow_end"] = 8000
		"Thunder Hawk":
			hero["evasion"] = maxf(0.0, float(hero.get("evasion", 0.0)) - 0.05)
		"Iron Beetle":
			hero["def"] = maxi(0, int(hero.get("def", 0)) - 10)
		"Venom Spider":
			var stacks: Array = hero.get("bleed_stacks", [])
			for i in range(3):
				stacks.append({"hp_snap": hero.get("hp", 0), "at": 0, "exp": 4000})
			hero["bleed_stacks"] = stacks
		"Bone Wraith":
			hero["max_hp"] = int(hero.get("max_hp", 0)) - 200
			hero["hp"] = mini(int(hero.get("hp", 0)), hero["max_hp"])
		"Flame Drake":
			hero["def"] = maxi(0, int(hero.get("def", 0)) - 20)
			hero["base_as"] = float(hero.get("base_as", 0.8)) * 0.85
		"Crystal Elemental":
			hero["def"] = maxi(0, int(hero.get("def", 0)) - 25)
		"Shadow Panther":
			hero["evasion"] = maxf(0.0, float(hero.get("evasion", 0.0)) - 0.08)
			hero["move_speed"] = maxi(30, int(hero.get("move_speed", 100)) - 20)
		"Storm Serpent":
			hero["shocked"] = true
			hero["shocked_end"] = 999999999
			hero["base_as"] = float(hero.get("base_as", 0.8)) * 0.9
		"Phoenix":
			hero["max_hp"] = int(hero.get("max_hp", 0)) - 400
			hero["hp"] = mini(int(hero.get("hp", 0)), hero["max_hp"])
			hero["base_dmg"] = maxi(10, int(hero.get("base_dmg", 0)) - 20)
		"Void Stalker":
			hero["evasion"] = maxf(0.0, float(hero.get("evasion", 0.0)) - 0.1)
			hero["base_as"] = float(hero.get("base_as", 0.8)) * 0.8
		"Ancient Treant":
			hero["move_speed"] = roundi(float(hero.get("move_speed", 100)) * 0.7)
		"Chaos Dragon":
			hero["max_hp"] = int(hero.get("max_hp", 0)) - 500
			hero["hp"] = mini(int(hero.get("hp", 0)), hero["max_hp"])
			hero["def"] = maxi(0, int(hero.get("def", 0)) - 30)
			hero["base_as"] = float(hero.get("base_as", 0.8)) * 0.8
		"Death Knight":
			hero["max_hp"] = int(hero.get("max_hp", 0)) - 400
			hero["hp"] = mini(int(hero.get("hp", 0)), hero["max_hp"])
			hero["base_dmg"] = maxi(10, int(hero.get("base_dmg", 0)) - 25)
			hero["def"] = maxi(0, int(hero.get("def", 0)) - 15)


# ============ Serialize build for arena upload ============

func serialize_build() -> Dictionary:
	var s := get_custom_total_stats()
	return {
		"name": _gs.custom_char.get("name", "Hero"),
		"sprite": _gs.custom_char.get("class_key", "barbarian"),
		"equipment": _gs.equipment.duplicate(true),
		"skills": _gs.custom_char.get("skills", []).duplicate(),
		"ultimate": _gs.custom_char.get("ultimate", null),
		"range_type": get_weapon_range_type(),
		"stats": {
			"hp": s.get("hp", 4000),
			"base_dmg": s.get("base_dmg", 100),
			"base_as": s.get("base_as", 0.8),
			"def": s.get("def", 40),
			"evasion": s.get("evasion", 0.0),
			"move_speed": s.get("move_speed", 100),
			"mana": s.get("mana", 0),
			"mana_regen": s.get("mana_regen", 0.0),
			"energy": s.get("energy", 0),
			"energy_regen": s.get("energy_regen", 0.0),
			"spell_dmg_bonus": s.get("spell_dmg_bonus", 0.0),
		}
	}


# ============ Build hero from arena opponent data (received from server) ============

func mk_arena_hero(build: Dictionary, side: String) -> Dictionary:
	var is_left: bool = side == "left"
	var stats: Dictionary = build.get("stats", {})
	var range_type: String = build.get("range_type", "melee")
	var h := _base_combat_fields(side)
	h["type"] = "custom"
	h["custom_sprite"] = build.get("sprite", "")
	h["name"] = build.get("name", "Opponent")
	h["color"] = "#d8b858"
	h["color_dark"] = "#4a3818"
	h["color_light"] = "#e8d080"
	h["x"] = float(CombatConstants.AX + 140) if is_left else float(CombatConstants.AX + CombatConstants.AW - 140)
	h["y"] = float(CombatConstants.GY)
	h["max_hp"] = int(stats.get("hp", 4000))
	h["hp"] = h["max_hp"]
	h["base_dmg"] = int(stats.get("base_dmg", 100))
	h["base_as"] = float(stats.get("base_as", 0.8))
	h["def"] = int(stats.get("def", 40))
	h["evasion"] = float(stats.get("evasion", 0.0))
	h["move_speed"] = int(stats.get("move_speed", 100))
	h["move_speed_bonus"] = 0.0
	_apply_hybrid_ranges(h, range_type)
	h["mana"] = int(stats.get("mana", 0))
	h["max_mana"] = h["mana"]
	h["mana_regen"] = float(stats.get("mana_regen", 0.0))
	h["spell_dmg_bonus"] = float(stats.get("spell_dmg_bonus", 0.0))
	h["spell_range"] = 400 if range_type == "ranged" else 200
	h["energy"] = int(stats.get("energy", 0))
	h["max_energy"] = h["energy"]
	h["energy_regen"] = float(stats.get("energy_regen", 0.0))
	h["resource"] = maxi(maxi(h["mana"], h["energy"]), 100)
	h["max_resource"] = h["resource"]
	h["resource_regen"] = maxf(maxf(h["mana_regen"], h["energy_regen"]), 2.0)

	# Copy equipment for rendering
	if build.has("equipment"):
		h["equipment"] = build.get("equipment", {})

	# Weapon visual type for VFX
	_apply_weapon_visual(h, h.get("equipment", {}))

	# Attach skills
	h["spells"] = {}
	h["custom_skill_ids"] = []
	var build_skills: Array = build.get("skills", [])
	for i in range(mini(2, build_skills.size())):
		var skill_idx = build_skills[i]
		if skill_idx != null and skill_idx >= 0 and skill_idx < _skills_data.size():
			var sk = _skills_data[skill_idx]
			h["spells"]["skill" + str(i)] = {"cd": 0, "bcd": int(sk.get("bcd", 3000)), "n": sk.get("name", "")}
			h["custom_skill_ids"].append({"idx": skill_idx, "key": "skill" + str(i)})

	# Attach ultimate
	var build_ult = build.get("ultimate", null)
	if build_ult != null and build_ult >= 0 and build_ult < _ults_data.size():
		var ult = _ults_data[build_ult]
		h["spells"]["ultimate"] = {"cd": 0, "bcd": 999999, "used": false, "n": ult.get("name", "")}
		h["custom_ult_id"] = build_ult

	return h
