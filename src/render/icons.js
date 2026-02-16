// =============== PIXEL ICON SYSTEM ===============
// 16x16 pixel art icons drawn programmatically

var iconCache = {};

// Each icon is an array of [x, y, w, h, color] entries
var ICON_DATA = {
  // --- WEAPONS ---
  sword: [
    [6,1,2,1,'#8a8a9a'],[7,1,1,1,'#bbbccc'],
    [6,2,2,2,'#7a7a8a'],[7,2,1,1,'#aaaabc'],
    [5,4,2,2,'#7a7a8a'],[6,4,1,1,'#aaaabc'],
    [4,6,2,2,'#7a7a8a'],[5,6,1,1,'#aaaabc'],
    [3,8,2,2,'#7a7a8a'],[4,8,1,1,'#aaaabc'],
    [2,10,4,2,'#5a4a3a'],[3,10,2,1,'#7a6a5a'],
    [1,11,2,3,'#3a2a1a'],[4,11,2,2,'#3a2a1a'],
  ],
  bow: [
    [10,2,2,2,'#6a4a2a'],[10,4,2,2,'#6a4a2a'],[10,6,2,2,'#6a4a2a'],
    [10,8,2,2,'#6a4a2a'],[10,10,2,2,'#6a4a2a'],
    [11,3,1,8,'#8a6a4a'],
    [9,2,1,1,'#6a4a2a'],[9,11,1,1,'#6a4a2a'],
    [8,3,1,9,'#8a7a5a'],
    [5,4,3,1,'#5a4a3a'],[6,4,1,1,'#7a6a5a'],
    [4,5,1,1,'#aaaabc'],[3,6,1,1,'#aaaabc'],[5,5,4,1,'#5a4a3a'],
  ],
  staff: [
    [7,2,2,12,'#5a4a2a'],[8,2,1,12,'#7a6a4a'],
    [6,0,4,3,'#2a6a5a'],[7,0,2,2,'#44ddbb'],[7,0,1,1,'#88ffdd'],
    [6,13,4,2,'#4a3a1a'],
  ],
  daggers: [
    [3,2,1,6,'#7a8a9a'],[3,2,1,1,'#bbbccc'],
    [2,8,3,2,'#3a3a4a'],[2,8,3,1,'#5a5a6a'],
    [11,2,1,6,'#7a8a9a'],[11,2,1,1,'#bbbccc'],
    [10,8,3,2,'#3a3a4a'],[10,8,3,1,'#5a5a6a'],
    [2,10,3,2,'#5a4a3a'],[10,10,3,2,'#5a4a3a'],
  ],
  axe: [
    [7,4,2,10,'#5a4a2a'],[8,4,1,10,'#7a6a4a'],
    [9,2,4,3,'#5a5a5a'],[10,1,3,5,'#6a6a6a'],[12,2,1,3,'#8a8a8a'],
    [9,5,4,3,'#5a5a5a'],[10,5,3,2,'#6a6a6a'],
  ],
  scythe: [
    [8,4,2,10,'#3a2a2a'],[9,4,1,10,'#5a4a4a'],
    [4,1,5,2,'#4a3a4a'],[3,2,3,2,'#5a4a5a'],[2,3,2,2,'#6a5a6a'],
    [2,3,1,1,'#8a7a8a'],
  ],

  // --- HELMETS ---
  steel_helm: [
    [4,4,8,8,'#5a5a5a'],[5,4,6,1,'#7a7a7a'],
    [4,3,8,2,'#6a6a6a'],[5,2,6,2,'#5a5a5a'],
    [6,1,4,2,'#6a6a6a'],
    [5,8,6,2,'#2a2a2a'],
    [4,12,8,2,'#4a4a4a'],
  ],
  cloth_cap: [
    [4,4,8,6,'#5a5a4a'],[5,3,6,2,'#6a6a5a'],
    [6,2,4,2,'#5a5a4a'],[5,4,6,1,'#7a7a6a'],
    [4,10,8,2,'#4a4a3a'],
  ],
  shadow_hood: [
    [3,3,10,10,'#2a2a3a'],[4,2,8,2,'#3a3a4a'],
    [6,1,4,2,'#2a2a3a'],[7,0,2,2,'#3a3a4a'],
    [5,8,6,2,'#1a1a2a'],
    [4,4,8,1,'#3a3a4a'],
  ],
  crown: [
    [3,6,10,4,'#6a5a2a'],[4,6,8,1,'#8a7a4a'],
    [3,4,2,3,'#6a5a2a'],[7,3,2,4,'#6a5a2a'],[11,4,2,3,'#6a5a2a'],
    [4,4,1,1,'#c8a848'],[7,3,1,1,'#c8a848'],[12,4,1,1,'#c8a848'],
    [5,7,2,2,'#4a6a8a'],[9,7,2,2,'#8a4a4a'],
  ],
  berserker_helm: [
    [4,4,8,8,'#4a2a2a'],[5,3,6,2,'#5a3a3a'],
    [3,5,2,6,'#4a2a2a'],[11,5,2,6,'#4a2a2a'],
    [5,8,6,2,'#2a1a1a'],
    [4,2,2,4,'#5a3a3a'],[10,2,2,4,'#5a3a3a'],
    [5,0,1,4,'#6a4a4a'],[10,0,1,4,'#6a4a4a'],
  ],
  horned_helm: [
    [4,5,8,7,'#5a3a2a'],[5,4,6,2,'#6a4a3a'],
    [5,8,6,2,'#3a2a1a'],
    [2,3,3,5,'#5a3a2a'],[1,1,2,4,'#6a4a3a'],[0,0,2,2,'#7a5a4a'],
    [11,3,3,5,'#5a3a2a'],[13,1,2,4,'#6a4a3a'],[14,0,2,2,'#7a5a4a'],
  ],

  // --- CHEST ARMOR ---
  cloth: [
    [4,3,8,9,'#5a5a4a'],[5,3,6,1,'#7a7a6a'],
    [4,7,8,1,'#4a4a3a'],
    [3,5,2,6,'#4a4a3a'],[11,5,2,6,'#4a4a3a'],
  ],
  chain: [
    [4,3,8,9,'#5a5a5a'],[5,3,6,1,'#7a7a7a'],
    [5,5,1,1,'#7a7a7a'],[7,5,1,1,'#7a7a7a'],[9,5,1,1,'#7a7a7a'],
    [6,7,1,1,'#7a7a7a'],[8,7,1,1,'#7a7a7a'],[10,7,1,1,'#7a7a7a'],
    [5,9,1,1,'#7a7a7a'],[7,9,1,1,'#7a7a7a'],[9,9,1,1,'#7a7a7a'],
    [3,5,2,6,'#4a4a4a'],[11,5,2,6,'#4a4a4a'],
  ],
  leather: [
    [4,3,8,9,'#5a3a2a'],[5,3,6,1,'#7a5a4a'],
    [7,5,1,7,'#4a2a1a'],[8,5,1,7,'#4a2a1a'],
    [3,5,2,6,'#5a3a2a'],[11,5,2,6,'#5a3a2a'],
  ],
  plate: [
    [4,3,8,9,'#4a4a4a'],[5,3,6,1,'#6a6a6a'],
    [5,5,2,2,'#6a6a6a'],[9,5,2,2,'#6a6a6a'],
    [5,9,2,2,'#6a6a6a'],[9,9,2,2,'#6a6a6a'],
    [7,4,2,8,'#5a5a5a'],
    [3,5,2,6,'#3a3a3a'],[11,5,2,6,'#3a3a3a'],
    [3,4,2,3,'#5a5a5a'],[11,4,2,3,'#5a5a5a'],
  ],
  robe: [
    [4,3,8,10,'#3a4a5a'],[5,3,6,1,'#5a6a7a'],
    [6,5,1,8,'#2a3a4a'],[9,5,1,8,'#2a3a4a'],
    [7,6,2,2,'#6aaa8a'],[7,6,1,1,'#88ffdd'],
    [3,5,2,7,'#3a4a5a'],[11,5,2,7,'#3a4a5a'],
  ],
  dragonscale: [
    [4,3,8,9,'#2a4a2a'],[5,3,6,1,'#4a6a4a'],
    [5,5,2,2,'#4a6a4a'],[8,5,2,2,'#4a6a4a'],
    [6,8,2,2,'#4a6a4a'],[9,8,2,2,'#4a6a4a'],
    [5,10,2,1,'#4a6a4a'],
    [3,5,2,6,'#2a4a2a'],[11,5,2,6,'#2a4a2a'],
    [7,6,2,2,'#c8a848'],
  ],

  // --- BOOTS ---
  sandals: [
    [3,10,4,3,'#5a4a3a'],[9,10,4,3,'#5a4a3a'],
    [4,10,2,1,'#7a6a5a'],[10,10,2,1,'#7a6a5a'],
  ],
  steel_boots: [
    [2,8,5,5,'#4a4a4a'],[9,8,5,5,'#4a4a4a'],
    [3,8,3,1,'#6a6a6a'],[10,8,3,1,'#6a6a6a'],
    [2,12,5,1,'#3a3a3a'],[9,12,5,1,'#3a3a3a'],
  ],
  swift_boots: [
    [3,9,4,4,'#5a3a2a'],[9,9,4,4,'#5a3a2a'],
    [4,9,2,1,'#7a5a4a'],[10,9,2,1,'#7a5a4a'],
    [1,11,2,1,'#7a5a4a'],[13,11,2,1,'#7a5a4a'],
  ],

  // --- ACCESSORIES ---
  ring: [
    [5,5,6,6,'#7a5a3a'],[6,4,4,1,'#9a7a5a'],
    [5,6,1,4,'#6a4a2a'],[10,6,1,4,'#9a7a5a'],
    [6,10,4,1,'#6a4a2a'],[6,5,4,4,'#0a0a0a00'],
    [7,6,2,2,'#c8a848'],
  ],
  amulet: [
    [7,2,2,1,'#5a4a2a'],[6,3,1,2,'#5a4a2a'],[9,3,1,2,'#5a4a2a'],
    [5,5,6,5,'#6a5a2a'],[6,5,4,1,'#8a7a4a'],
    [7,7,2,2,'#c8a848'],[7,7,1,1,'#e8d868'],
    [5,10,6,1,'#5a4a1a'],
  ],
  crystal: [
    [7,2,2,2,'#4a6a8a'],[6,4,4,4,'#6a8aaa'],
    [7,4,2,1,'#8aaacc'],[7,5,1,1,'#aaccee'],
    [5,6,6,3,'#4a6a8a'],[6,8,4,3,'#3a5a7a'],
    [7,10,2,2,'#2a4a6a'],
  ],
  cloak: [
    [4,2,8,10,'#2a2a3a'],[5,2,6,1,'#3a3a4a'],
    [3,4,2,8,'#2a2a3a'],[11,4,2,8,'#2a2a3a'],
    [4,11,8,2,'#1a1a2a'],
    [6,5,4,6,'#3a3a4a'],
  ],
  totem: [
    [6,2,4,2,'#5a3a2a'],[7,2,2,1,'#7a5a4a'],
    [7,4,2,6,'#5a3a2a'],[7,4,1,6,'#7a5a4a'],
    [6,6,4,2,'#7a5a4a'],[7,6,2,1,'#9a7a5a'],
    [6,10,4,3,'#4a2a1a'],
  ],
  heart: [
    [4,4,3,3,'#6a1a1a'],[9,4,3,3,'#6a1a1a'],
    [3,5,10,4,'#8a2a2a'],[4,5,8,1,'#aa3a3a'],
    [4,9,8,2,'#6a1a1a'],[5,11,6,1,'#5a1a1a'],
    [6,12,4,1,'#4a0a0a'],[7,13,2,1,'#3a0a0a'],
    [6,6,1,1,'#aa4a4a'],
  ],
  charm: [
    [6,3,4,3,'#5a6a4a'],[7,3,2,1,'#7a8a6a'],
    [5,6,6,4,'#5a6a4a'],[6,6,4,1,'#7a8a6a'],
    [7,8,2,2,'#8aaa6a'],
    [6,10,4,2,'#4a5a3a'],
    [7,1,2,2,'#3a4a2a'],
  ],

  // --- CREATURES ---
  goblin: [
    [5,2,6,5,'#4a6a2a'],[6,2,4,1,'#5a7a3a'],
    [4,3,2,2,'#5a7a3a'],[10,3,2,2,'#5a7a3a'],
    [6,4,1,1,'#aa2222'],[9,4,1,1,'#aa2222'],
    [7,6,2,1,'#3a5a1a'],
    [5,7,6,5,'#3a5a1a'],[6,7,4,1,'#4a6a2a'],
    [4,8,2,4,'#3a5a1a'],[10,8,2,4,'#3a5a1a'],
    [5,12,3,2,'#2a4a0a'],[8,12,3,2,'#2a4a0a'],
  ],
  bat: [
    [7,3,2,3,'#3a2a3a'],[7,3,2,1,'#4a3a4a'],
    [7,5,1,1,'#aa2222'],[8,5,1,1,'#aa2222'],
    [3,4,4,3,'#3a2a3a'],[9,4,4,3,'#3a2a3a'],
    [1,3,3,2,'#4a3a4a'],[12,3,3,2,'#4a3a4a'],
    [0,2,2,2,'#3a2a3a'],[14,2,2,2,'#3a2a3a'],
  ],
  skeleton: [
    [6,1,4,4,'#c8c8b8'],[7,1,2,1,'#dadaca'],
    [6,3,1,1,'#2a2a2a'],[9,3,1,1,'#2a2a2a'],
    [7,5,2,1,'#aaaaaa'],
    [6,6,4,5,'#c8c8b8'],[7,6,2,1,'#dadaca'],
    [5,7,2,4,'#b8b8a8'],[9,7,2,4,'#b8b8a8'],
    [6,11,2,3,'#aaaaaa'],[8,11,2,3,'#aaaaaa'],
  ],
  dragon: [
    [5,1,6,5,'#2a6a2a'],[6,1,4,1,'#3a7a3a'],
    [3,2,3,3,'#2a6a2a'],[10,2,3,3,'#2a6a2a'],
    [6,3,1,1,'#aa4a00'],[9,3,1,1,'#aa4a00'],
    [5,6,6,6,'#1a5a1a'],[6,6,4,1,'#2a6a2a'],
    [2,4,3,4,'#3a7a3a'],[11,4,3,4,'#3a7a3a'],
    [1,3,2,2,'#4a8a4a'],[13,3,2,2,'#4a8a4a'],
    [5,12,2,2,'#1a4a1a'],[9,12,2,2,'#1a4a1a'],
  ],
  demon: [
    [5,3,6,5,'#6a1a2a'],[6,3,4,1,'#8a2a3a'],
    [3,2,3,2,'#8a2a3a'],[10,2,3,2,'#8a2a3a'],
    [2,1,2,2,'#6a1a2a'],[12,1,2,2,'#6a1a2a'],
    [6,5,1,1,'#ffaa00'],[9,5,1,1,'#ffaa00'],
    [5,8,6,5,'#5a1a1a'],[6,8,4,1,'#6a2a2a'],
    [4,9,2,4,'#5a1a1a'],[10,9,2,4,'#5a1a1a'],
    [5,13,2,2,'#4a0a0a'],[9,13,2,2,'#4a0a0a'],
  ],
  slime: [
    [4,6,8,6,'#2a7a2a'],[5,5,6,2,'#3a8a3a'],
    [6,4,4,2,'#3a8a3a'],[7,4,2,1,'#4a9a4a'],
    [5,7,2,2,'#1a6a1a'],[9,7,2,2,'#1a6a1a'],
    [6,8,1,1,'#fff'],[10,8,1,1,'#fff'],
    [3,11,10,2,'#1a5a1a'],
  ],
  ghost: [
    [5,2,6,6,'#8a8aaa'],[6,2,4,1,'#aaaabb'],
    [6,5,1,1,'#2a2a4a'],[9,5,1,1,'#2a2a4a'],
    [4,5,8,6,'#7a7a9a'],[5,5,6,1,'#9a9abb'],
    [4,10,2,3,'#6a6a8a'],[7,10,2,3,'#6a6a8a'],[10,10,2,3,'#6a6a8a'],
    [3,11,2,2,'#5a5a7a'],[11,11,2,2,'#5a5a7a'],
  ],

  // --- FOLLOWERS ---
  fire_imp: [
    [6,2,4,4,'#cc5500'],[7,2,2,1,'#dd6622'],
    [6,4,1,1,'#ffaa00'],[9,4,1,1,'#ffaa00'],
    [5,6,6,5,'#aa3300'],[6,6,4,1,'#cc5500'],
    [4,7,2,4,'#aa3300'],[10,7,2,4,'#aa3300'],
    [7,0,2,3,'#ffcc44'],[7,0,1,1,'#ffdd66'],
  ],
  wolf: [
    [4,3,8,5,'#6a6a7a'],[5,3,6,1,'#7a7a8a'],
    [3,4,2,3,'#5a5a6a'],[11,4,2,3,'#5a5a6a'],
    [5,5,1,1,'#aaccee'],[9,5,1,1,'#aaccee'],
    [4,8,8,4,'#5a5a6a'],[5,8,6,1,'#6a6a7a'],
    [4,12,2,2,'#4a4a5a'],[10,12,2,2,'#4a4a5a'],
    [12,5,3,2,'#5a5a6a'],
  ],
  phoenix: [
    [6,1,4,4,'#cc6600'],[7,0,2,2,'#ff8833'],
    [6,3,1,1,'#ffcc44'],[9,3,1,1,'#ffcc44'],
    [5,5,6,5,'#aa4400'],[6,5,4,1,'#cc6600'],
    [2,4,4,4,'#cc6600'],[10,4,4,4,'#cc6600'],
    [1,3,2,2,'#ff8833'],[13,3,2,2,'#ff8833'],
    [5,10,6,3,'#ffaa44'],[6,12,4,1,'#ffcc66'],
  ],

  // --- UI/ROOMS ---
  gold_pile: [
    [4,8,8,4,'#8a7a2a'],[5,7,6,2,'#aa9a3a'],
    [6,6,4,2,'#c8a848'],[7,6,2,1,'#e8d868'],
    [3,11,10,2,'#6a5a1a'],
    [5,9,2,2,'#e8d868'],[8,8,2,2,'#c8a848'],
  ],
  campfire: [
    [6,10,4,3,'#5a3a1a'],[5,12,6,2,'#4a2a0a'],
    [7,5,2,5,'#cc6600'],[6,4,4,3,'#ff8833'],
    [7,3,2,2,'#ffaa44'],[7,2,2,2,'#ffcc66'],
    [8,1,1,2,'#ffdd88'],
  ],
  shrine: [
    [6,2,4,2,'#6a5a2a'],[5,4,6,2,'#5a4a2a'],
    [7,0,2,2,'#c8a848'],[7,0,1,1,'#e8d868'],
    [6,6,4,8,'#4a3a2a'],[7,6,2,1,'#6a5a4a'],
    [5,14,6,1,'#3a2a1a'],
  ],
  potion: [
    [7,2,2,3,'#4a4a5a'],[7,2,2,1,'#6a6a7a'],
    [6,5,4,1,'#4a4a5a'],
    [5,6,6,6,'#2a6a2a'],[6,6,4,1,'#3a8a3a'],
    [7,8,2,2,'#4a9a4a'],
    [5,12,6,1,'#1a5a1a'],
  ],
  crossed_swords: [
    [2,2,2,2,'#7a7a8a'],[3,4,2,2,'#7a7a8a'],[5,6,2,2,'#7a7a8a'],
    [7,7,2,3,'#5a4a3a'],
    [12,2,2,2,'#7a7a8a'],[11,4,2,2,'#7a7a8a'],[9,6,2,2,'#7a7a8a'],
    [7,7,2,3,'#5a4a3a'],
  ],
  warning: [
    [7,2,2,2,'#c8a848'],[6,4,4,2,'#c8a848'],
    [5,6,6,2,'#c8a848'],[4,8,8,2,'#c8a848'],
    [3,10,10,2,'#c8a848'],[7,5,2,3,'#1a1a0a'],
    [7,10,2,2,'#1a1a0a'],
  ],
  merchant: [
    [6,2,4,4,'#b8a080'],[7,2,2,1,'#c8b090'],
    [6,4,1,1,'#2a2a2a'],[9,4,1,1,'#2a2a2a'],
    [5,6,6,6,'#5a4a3a'],[6,6,4,1,'#6a5a4a'],
    [4,7,2,5,'#5a4a3a'],[10,7,2,5,'#5a4a3a'],
    [5,12,2,2,'#3a2a1a'],[9,12,2,2,'#3a2a1a'],
    [7,8,2,2,'#c8a848'],
  ],
  cage: [
    [3,2,10,1,'#5a5a5a'],[3,13,10,1,'#5a5a5a'],
    [3,2,1,12,'#5a5a5a'],[12,2,1,12,'#5a5a5a'],
    [5,2,1,12,'#4a4a4a'],[7,2,1,12,'#4a4a4a'],
    [9,2,1,12,'#4a4a4a'],[11,2,1,12,'#4a4a4a'],
    [7,7,2,2,'#aa6a3a'],
  ],
};

// Map item visual types to icon keys
var VISUAL_TO_ICON = {
  'sword':'sword','bow':'bow','staff':'staff','daggers':'daggers',
  'axe':'axe','scythe':'scythe',
  'steel_helm':'steel_helm','cloth_cap':'cloth_cap','shadow_hood':'shadow_hood',
  'crown':'crown','berserker_helm':'berserker_helm','horned_helm':'horned_helm',
  'cloth':'cloth','chain':'chain','leather':'leather','plate':'plate',
  'blood_plate':'plate','robe':'robe','dragonscale':'dragonscale',
  'sandals':'sandals','steel_boots':'steel_boots','swift_boots':'swift_boots',
  'war_treads':'steel_boots','windwalkers':'swift_boots','stormstriders':'swift_boots',
  'ring':'ring','amulet':'amulet','crystal':'crystal','mana_crystal':'crystal',
  'cloak':'cloak','shadow_cloak':'cloak','totem':'totem',
  'heart':'heart','charm':'charm',
};

// Map emoji to icon keys (fallback)
var EMOJI_TO_ICON = {
  '\u2694':'crossed_swords','\u{1F5E1}':'sword','\u{1F3F9}':'bow',
  '\u{1FA84}':'staff','\u{1F52E}':'crystal','\u{1FA93}':'axe','\u26B0':'scythe',
  '\u{1F9E2}':'cloth_cap','\u26D1':'steel_helm','\u{1F3AD}':'shadow_hood',
  '\u{1F451}':'crown','\u{1F480}':'skeleton','\u{1F409}':'dragon',
  '\u{1F455}':'cloth','\u26D3':'chain','\u{1F9BA}':'leather',
  '\u{1F6E1}':'plate','\u{1F9E5}':'robe','\u{1F432}':'dragon',
  '\u{1FA74}':'sandals','\u{1F97E}':'steel_boots','\u{1F45F}':'swift_boots',
  '\u{1F9B6}':'steel_boots','\u{1F4A8}':'swift_boots',
  '\u{1F48D}':'ring','\u{1F48E}':'crystal','\u{1F311}':'cloak',
  '\u{1F4FF}':'amulet','\u{1F9B4}':'totem','\u{1F525}':'fire_imp',
  '\u{1F47A}':'goblin','\u{1F987}':'bat','\u{1F7E2}':'slime',
  '\u{1F479}':'goblin','\u{1F9D9}':'ghost','\u{1F9CC}':'goblin',
  '\u{1F47B}':'ghost','\u{1F402}':'goblin','\u{1F5FF}':'skeleton',
  '\u{1F608}':'demon','\u{1F40D}':'dragon',
  '\u2620':'skeleton','\u{1F4B0}':'gold_pile','\u26A0':'warning',
  '\u{1F3D5}':'campfire','\u26E9':'shrine','\u{1F47E}':'cage',
  '\u{1F3EA}':'merchant','\u{1F9EA}':'potion',
  '\u{1F43A}':'wolf','\u{1F985}':'phoenix','\u{1FAB2}':'steel_boots',
  '\u{1F577}':'bat','\u{1F406}':'wolf','\u{1F99A}':'phoenix',
  '\u{1F333}':'campfire','\u2728':'fire_imp','\u{1F400}':'bat',
  '\u{1FAA8}':'steel_boots','\u{1F41B}':'slime',
};

function renderToCanvas(key){
  if(iconCache[key])return iconCache[key];
  var data=ICON_DATA[key];
  if(!data)return null;
  var c=document.createElement('canvas');
  c.width=16;c.height=16;
  var ctx=c.getContext('2d');
  for(var i=0;i<data.length;i++){
    var p=data[i];
    if(p[4]==='#0a0a0a00')continue; // transparent
    ctx.fillStyle=p[4];
    ctx.fillRect(p[0],p[1],p[2],p[3]);
  }
  iconCache[key]=c;
  return c;
}

export function iconImg(key,size){
  size=size||16;
  var c=renderToCanvas(key);
  if(!c)return '';
  return '<img src="'+c.toDataURL()+'" width="'+size+'" height="'+size+'" style="image-rendering:pixelated;vertical-align:middle">';
}

export function drawIcon(ctx,key,x,y,scale){
  scale=scale||1;
  var c=renderToCanvas(key);
  if(!c)return;
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(c,x,y,16*scale,16*scale);
  ctx.imageSmoothingEnabled=true;
}

export function getIconKey(obj){
  // Check for explicit iconKey
  if(obj&&obj.iconKey&&ICON_DATA[obj.iconKey])return obj.iconKey;
  // Check visual type mapping
  if(obj&&obj.visual&&obj.visual.type&&VISUAL_TO_ICON[obj.visual.type])return VISUAL_TO_ICON[obj.visual.type];
  // Check emoji mapping
  if(obj&&obj.icon&&EMOJI_TO_ICON[obj.icon])return EMOJI_TO_ICON[obj.icon];
  return null;
}

export function getIcon(obj,size){
  var key=getIconKey(obj);
  if(key)return iconImg(key,size);
  // Fallback to emoji
  if(obj&&obj.icon)return '<span style="font-size:'+(size||16)+'px;vertical-align:middle">'+obj.icon+'</span>';
  return '';
}

export { ICON_DATA };
