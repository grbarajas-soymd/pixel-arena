// =============== SHARED SERVER CONSTANTS ===============

export var VALID_BASE_KEYS = new Set([
  // Starter
  'rusty_blade', 'wooden_bow', 'worn_wand', 'cloth_cap', 'cloth_tunic', 'worn_sandals', 'copper_ring', 'rusty_daggers',
  // Common
  'iron_sword', 'hunting_knives', 'arcane_staff', 'steel_helm', 'chain_mail', 'steel_boots', 'power_ring',
  // Uncommon
  'crystal_staff', 'shortbow', 'shadow_hood', 'leather_vest', 'swift_boots', 'speed_charm',
  // Rare
  'frost_daggers', 'cursed_scythe', 'mage_crown', 'berserker_helm', 'mage_robe', 'plate_armor', 'war_treads', 'shadow_cloak', 'mana_crystal',
  // Epic
  'longbow', 'war_axe', 'dragon_helm', 'blood_plate', 'windwalkers', 'life_amulet', 'berserker_totem',
  // Legendary
  'great_sword', 'crown_of_abyss', 'dragonscale', 'stormstriders', 'heart_of_chaos',
  // Mythic
  'soulreaver', 'astral_longbow', 'crown_of_eternity', 'voidplate', 'godstriders', 'heart_of_abyss'
]);

export var VALID_SPRITES = ['wizard', 'ranger', 'assassin', 'barbarian'];

export var AUDIT_STAT_CAPS = { hp: 15000, baseDmg: 800, baseAS: 4.0, def: 400, evasion: 0.8, moveSpeed: 400 };

export var UPLOAD_STAT_CAPS = { hp: 20000, baseDmg: 1000, baseAS: 5.0, def: 500, evasion: 0.8, moveSpeed: 500 };
