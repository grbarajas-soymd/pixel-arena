extends RefCounted
## Maps item base_keys and skill IDs to generated icon texture paths.
class_name IconMap

const ICON_BASE := "res://assets/sprites/generated/gear/"
const ICON_BASE_SKILLS := "res://assets/sprites/generated/skills/"

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

## Slot placeholder icons (empty slot) — AI-generated.
const SLOT_ICONS: Dictionary = {
	"weapon": "slot_weapon.png",
	"helmet": "slot_helmet.png",
	"chest": "slot_chest.png",
	"boots": "slot_boots.png",
	"accessory": "slot_accessory.png",
}


static func get_item_icon(base_key: String) -> Texture2D:
	var filename: String = ITEM_ICONS.get(base_key, "")
	if filename.is_empty():
		return null
	return load(ICON_BASE + filename)


static func get_skill_icon(skill_id: String) -> Texture2D:
	var gen_path := ICON_BASE_SKILLS + skill_id + ".png"
	if ResourceLoader.exists(gen_path):
		return load(gen_path)
	return null


static func get_slot_icon(slot: String) -> Texture2D:
	var filename: String = SLOT_ICONS.get(slot, "")
	if filename.is_empty():
		return null
	return load(ICON_BASE + filename)
