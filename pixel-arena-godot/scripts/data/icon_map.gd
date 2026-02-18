extends RefCounted
## Maps item base_keys and skill IDs to rpg_icon texture paths.
class_name IconMap

const ICON_BASE := "res://assets/sprites/generated/gear/"
const ICON_BASE_SKILLS := "res://assets/sprites/generated/skills/"
const ICON_BASE_LEGACY := "res://assets/sprites/gear/rpg_icons/"

## Item base_key → icon filename (generated sprites).
const ITEM_ICONS: Dictionary = {
	# -- Weapons --
	"rusty_blade": "rusty_blade.png",
	"wooden_bow": "wooden_bow.png",
	"worn_wand": "worn_wand.png",
	"rusty_daggers": "rusty_daggers.png",
	"iron_sword": "iron_sword.png",
	"hunting_knives": "hunting_knives.png",
	"arcane_staff": "arcane_staff.png",
	"crystal_staff": "crystal_staff.png",
	"shortbow": "shortbow.png",
	"frost_daggers": "frost_daggers.png",
	"cursed_scythe": "cursed_scythe.png",
	"longbow": "longbow.png",
	"war_axe": "war_axe.png",
	"great_sword": "great_sword.png",
	"soulreaver": "soulreaver.png",
	"astral_longbow": "astral_longbow.png",

	# -- Helmets --
	"cloth_cap": "cloth_cap.png",
	"steel_helm": "steel_helm.png",
	"shadow_hood": "shadow_hood.png",
	"mage_crown": "mage_crown.png",
	"berserker_helm": "berserker_helm.png",
	"dragon_helm": "dragon_helm.png",
	"crown_of_abyss": "crown_of_abyss.png",
	"crown_of_eternity": "crown_of_eternity.png",

	# -- Chest --
	"cloth_tunic": "cloth_tunic.png",
	"chain_mail": "chain_mail.png",
	"leather_vest": "leather_vest.png",
	"mage_robe": "mage_robe.png",
	"plate_armor": "plate_armor.png",
	"blood_plate": "blood_plate.png",
	"dragonscale": "dragonscale.png",
	"voidplate": "voidplate.png",

	# -- Boots --
	"worn_sandals": "worn_sandals.png",
	"steel_boots": "steel_boots.png",
	"swift_boots": "swift_boots.png",
	"war_treads": "war_treads.png",
	"windwalkers": "windwalkers.png",
	"stormstriders": "stormstriders.png",
	"godstriders": "godstriders.png",

	# -- Accessories --
	"copper_ring": "copper_ring.png",
	"power_ring": "power_ring.png",
	"speed_charm": "speed_charm.png",
	"shadow_cloak": "shadow_cloak.png",
	"mana_crystal": "mana_crystal.png",
	"life_amulet": "life_amulet.png",
	"berserker_totem": "berserker_totem.png",
	"heart_of_chaos": "heart_of_chaos.png",
	"heart_of_abyss": "heart_of_abyss.png",
}

## Skill ID → icon filename.
const SKILL_ICONS: Dictionary = {
	"chain_lightning": "S_Thunder01.png",
	"lightning_bolt": "S_Thunder03.png",
	"static_shield": "S_Buff01.png",
	"hunters_mark": "S_Bow01.png",
	"bloodlust": "S_Buff05.png",
	"summon_pet": "S_Fire01.png",
	"shadow_step": "S_Shadow01.png",
	"envenom": "S_Poison01.png",
	"smoke_bomb": "S_Shadow05.png",
	"charge": "S_Sword01.png",
	"war_cry": "S_Buff03.png",
	"frost_nova": "S_Ice01.png",
	"arcane_drain": "S_Magic01.png",
	"rupture": "S_Sword05.png",
	"marked_for_death": "S_Shadow09.png",
	"lacerate": "S_Dagger02.png",
	"riposte": "S_Buff08.png",
	"battle_trance": "S_Fire05.png",
	"thorns": "S_Earth01.png",
}

## Ultimate ID → icon filename.
const ULT_ICONS: Dictionary = {
	"thunderstorm": "S_Thunder07.png",
	"rain_of_fire": "S_Fire08.png",
	"death_mark": "S_Shadow16.png",
	"berserker": "S_Buff14.png",
	"arcane_overload": "S_Magic11.png",
	"primal_fury": "S_Earth07.png",
	"shadow_dance": "S_Shadow10.png",
	"last_stand": "S_Holy10.png",
}

## Slot placeholder icons (empty slot).
const SLOT_ICONS: Dictionary = {
	"weapon": "W_Sword001.png",
	"helmet": "E_Metal01.png",
	"chest": "A_Armour01.png",
	"boots": "A_Shoes01.png",
	"accessory": "Ac_Ring01.png",
}


static func get_item_icon(base_key: String) -> Texture2D:
	var filename: String = ITEM_ICONS.get(base_key, "")
	if filename.is_empty():
		return null
	var tex = load(ICON_BASE + filename)
	if tex == null:
		# Fallback to legacy rpg_icons if generated sprite not found
		tex = load(ICON_BASE_LEGACY + filename)
	return tex


static func get_skill_icon(skill_id: String) -> Texture2D:
	# Try generated AI skill icon first
	var gen_path := ICON_BASE_SKILLS + skill_id + ".png"
	if ResourceLoader.exists(gen_path):
		return load(gen_path)
	# Fall back to legacy rpg_icons
	var filename: String = SKILL_ICONS.get(skill_id, "")
	if filename.is_empty():
		filename = ULT_ICONS.get(skill_id, "")
	if filename.is_empty():
		return null
	return load(ICON_BASE_LEGACY + filename)


static func get_slot_icon(slot: String) -> Texture2D:
	var filename: String = SLOT_ICONS.get(slot, "")
	if filename.is_empty():
		return null
	return load(ICON_BASE_LEGACY + filename)
