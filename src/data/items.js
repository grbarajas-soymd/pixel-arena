// =============== ITEMS DATABASE ===============

export const GEAR_RARITY_COLORS = {
  starter:'#888888',
  common:'#aaaaaa',
  uncommon:'#44cc44',
  rare:'#4488ff',
  epic:'#cc44ff',
  legendary:'#ffaa00',
};

export const ITEMS = {
  // — Starter (never drops, only starting equipment) —
  rusty_blade:{slot:'weapon',icon:'\u{1F5E1}',name:'Rusty Blade',rarity:'starter',rangeType:'melee',stats:{baseDmg:30,baseAS:0.5},desc:'+30Dmg 0.5AS'},
  wooden_bow:{slot:'weapon',icon:'\u{1F3F9}',name:'Wooden Bow',rarity:'starter',rangeType:'ranged',stats:{baseDmg:25,baseAS:0.7},desc:'+25Dmg 0.7AS'},
  worn_wand:{slot:'weapon',icon:'\u{1FA84}',name:'Worn Wand',rarity:'starter',rangeType:'ranged',stats:{baseDmg:20,baseAS:0.4,mana:50},desc:'+20Dmg 0.4AS +50Mana'},
  cloth_cap:{slot:'helmet',icon:'\u{1F9E2}',name:'Cloth Cap',rarity:'starter',stats:{def:3,hp:50},desc:'+3DEF +50HP'},
  cloth_tunic:{slot:'chest',icon:'\u{1F455}',name:'Cloth Tunic',rarity:'starter',stats:{def:5,hp:80},desc:'+5DEF +80HP'},
  worn_sandals:{slot:'boots',icon:'\u{1FA74}',name:'Worn Sandals',rarity:'starter',stats:{def:1,moveSpeed:5},desc:'+1DEF +5Spd'},
  copper_ring:{slot:'accessory',icon:'\u{1F48D}',name:'Copper Ring',rarity:'starter',stats:{baseDmg:5},desc:'+5Dmg'},

  // — Common —
  arcane_staff:{slot:'weapon',icon:'\u{1FA84}',name:'Arcane Staff',rarity:'common',rangeType:'ranged',stats:{baseDmg:95,baseAS:0.75},desc:'+95Dmg 0.75AS'},
  steel_helm:{slot:'helmet',icon:'\u26D1',name:'Steel Helm',rarity:'common',stats:{def:15,hp:200},desc:'+15DEF +200HP'},
  chain_mail:{slot:'chest',icon:'\u26D3',name:'Chain Mail',rarity:'common',stats:{def:22,hp:300},desc:'+22DEF +300HP'},
  steel_boots:{slot:'boots',icon:'\u{1F97E}',name:'Steel Boots',rarity:'common',stats:{def:8,moveSpeed:10},desc:'+8DEF +10Spd'},
  power_ring:{slot:'accessory',icon:'\u{1F48D}',name:'Ring of Power',rarity:'common',stats:{baseDmg:30},desc:'+30Dmg'},

  // — Uncommon —
  crystal_staff:{slot:'weapon',icon:'\u{1F52E}',name:'Crystal Staff',rarity:'uncommon',rangeType:'ranged',stats:{baseDmg:120,baseAS:0.65},desc:'+120Dmg 0.65AS'},
  shortbow:{slot:'weapon',icon:'\u{1F3F9}',name:'Swift Shortbow',rarity:'uncommon',rangeType:'ranged',stats:{baseDmg:140,baseAS:1.4},desc:'+140Dmg 1.4AS'},
  shadow_hood:{slot:'helmet',icon:'\u{1F3AD}',name:'Shadow Hood',rarity:'uncommon',stats:{def:8,evasion:0.05,moveSpeed:10},desc:'+5%Eva +10Spd'},
  leather_vest:{slot:'chest',icon:'\u{1F9BA}',name:'Leather Vest',rarity:'uncommon',stats:{def:15,evasion:0.08,moveSpeed:15},desc:'+8%Eva +15Spd'},
  swift_boots:{slot:'boots',icon:'\u{1F45F}',name:'Swift Boots',rarity:'uncommon',stats:{def:3,moveSpeed:40,evasion:0.03},desc:'+40Spd +3%Eva'},
  speed_charm:{slot:'accessory',icon:'\u26A1',name:'Speed Charm',rarity:'uncommon',stats:{baseAS:0.15,moveSpeed:15},desc:'+0.15AS +15Spd'},

  // — Rare —
  frost_daggers:{slot:'weapon',icon:'\u{1F5E1}',name:'Frost Daggers',rarity:'rare',rangeType:'melee',stats:{baseDmg:175,baseAS:1.4},desc:'+175Dmg 1.4AS'},
  cursed_scythe:{slot:'weapon',icon:'\u26B0',name:'Cursed Scythe',rarity:'rare',rangeType:'melee',stats:{baseDmg:200,baseAS:0.95},desc:'+200Dmg 0.95AS'},
  mage_crown:{slot:'helmet',icon:'\u{1F451}',name:'Arcane Crown',rarity:'rare',stats:{def:5,mana:100,spellDmgBonus:0.05},desc:'+100Mana +5%Spell'},
  berserker_helm:{slot:'helmet',icon:'\u{1F480}',name:'Berserker Helm',rarity:'rare',stats:{def:10,hp:400},desc:'+10DEF +400HP'},
  mage_robe:{slot:'chest',icon:'\u{1F9E5}',name:'Arcane Robe',rarity:'rare',stats:{def:10,mana:150,manaRegen:2},desc:'+150Mana +2/s'},
  plate_armor:{slot:'chest',icon:'\u{1F6E1}',name:'Plate Armor',rarity:'rare',stats:{def:30,hp:500,moveSpeed:-10},desc:'+30DEF +500HP -10Spd'},
  war_treads:{slot:'boots',icon:'\u{1F9B6}',name:'War Treads',rarity:'rare',stats:{def:12,moveSpeed:25,hp:150},desc:'+12DEF +25Spd'},
  shadow_cloak:{slot:'accessory',icon:'\u{1F311}',name:'Shadow Cloak',rarity:'rare',stats:{evasion:0.10,def:5},desc:'+10%Eva +5DEF'},
  mana_crystal:{slot:'accessory',icon:'\u{1F48E}',name:'Mana Crystal',rarity:'rare',stats:{mana:200,manaRegen:3},desc:'+200Mana +3/s'},

  // — Epic —
  longbow:{slot:'weapon',icon:'\u{1F3F9}',name:'Flame Longbow',rarity:'epic',rangeType:'ranged',stats:{baseDmg:205,baseAS:1.0},desc:'+205Dmg 1.0AS'},
  war_axe:{slot:'weapon',icon:'\u{1FA93}',name:'Blood War Axe',rarity:'epic',rangeType:'melee',stats:{baseDmg:230,baseAS:0.85},desc:'+230Dmg 0.85AS'},
  dragon_helm:{slot:'helmet',icon:'\u{1F409}',name:'Dragon Helm',rarity:'epic',stats:{def:20,hp:300},desc:'+20DEF +300HP'},
  blood_plate:{slot:'chest',icon:'\u2764',name:'Blood Plate',rarity:'epic',stats:{def:25,hp:800},desc:'+25DEF +800HP'},
  windwalkers:{slot:'boots',icon:'\u{1F4A8}',name:'Windwalkers',rarity:'epic',stats:{def:6,moveSpeed:55,evasion:0.06},desc:'+55Spd +6%Eva'},
  life_amulet:{slot:'accessory',icon:'\u{1F4FF}',name:'Life Amulet',rarity:'epic',stats:{hp:600},desc:'+600HP'},
  berserker_totem:{slot:'accessory',icon:'\u{1F9B4}',name:'Berserker Totem',rarity:'epic',stats:{baseDmg:40,hp:300},desc:'+40Dmg +300HP'},

  // — Legendary —
  great_sword:{slot:'weapon',icon:'\u2694',name:'Greatsword',rarity:'legendary',rangeType:'melee',stats:{baseDmg:260,baseAS:0.7},desc:'+260Dmg 0.7AS'},
  crown_of_abyss:{slot:'helmet',icon:'\u{1F451}',name:'Crown of the Abyss',rarity:'legendary',stats:{def:25,hp:500,spellDmgBonus:0.10},desc:'+25DEF +500HP +10%Spell'},
  dragonscale:{slot:'chest',icon:'\u{1F432}',name:'Dragonscale',rarity:'legendary',stats:{def:40,hp:1000,moveSpeed:-5},desc:'+40DEF +1000HP -5Spd'},
  stormstriders:{slot:'boots',icon:'\u26A1',name:'Stormstriders',rarity:'legendary',stats:{def:10,moveSpeed:65,evasion:0.08,baseAS:0.1},desc:'+65Spd +8%Eva +0.1AS'},
  heart_of_chaos:{slot:'accessory',icon:'\u{1F525}',name:'Heart of Chaos',rarity:'legendary',stats:{baseDmg:55,hp:400,baseAS:0.1},desc:'+55Dmg +400HP +0.1AS'},
};

export const EQ_SLOTS = [
  {key:'weapon',icon:'\u2694',label:'Weapon'},
  {key:'helmet',icon:'\u26D1',label:'Helmet'},
  {key:'chest',icon:'\u{1F6E1}',label:'Chest'},
  {key:'boots',icon:'\u{1F97E}',label:'Boots'},
  {key:'accessory',icon:'\u{1F48D}',label:'Access.'}
];

export const ED_STATS = [
  {key:'hp',label:'HP'},{key:'baseDmg',label:'Dmg'},{key:'baseAS',label:'AtkSpd'},
  {key:'def',label:'DEF'},{key:'evasion',label:'Eva%'},{key:'moveSpeed',label:'MvSpd'},
  {key:'mana',label:'Mana'},{key:'manaRegen',label:'Mana/s'},{key:'energy',label:'Energy'},
  {key:'energyRegen',label:'Eng/s'},{key:'spellDmgBonus',label:'SpDmg%'}
];

export var STARTER_LOADOUTS = {
  melee: {
    equipment: { weapon:'rusty_blade', helmet:'cloth_cap', chest:'cloth_tunic', boots:'worn_sandals', accessory:'copper_ring' },
    sprite: 'barbarian', skills: [9, 10], ultimate: 3, name: 'Warrior',
  },
  ranged: {
    equipment: { weapon:'wooden_bow', helmet:'cloth_cap', chest:'cloth_tunic', boots:'worn_sandals', accessory:'copper_ring' },
    sprite: 'ranger', skills: [3, 4], ultimate: 1, name: 'Archer',
  },
  caster: {
    equipment: { weapon:'worn_wand', helmet:'cloth_cap', chest:'cloth_tunic', boots:'worn_sandals', accessory:'copper_ring' },
    sprite: 'wizard', skills: [0, 2], ultimate: 0, name: 'Mage',
  },
};

// Backwards compat fallback
export var STARTER_GEAR = STARTER_LOADOUTS.melee.equipment;

var DROP_WEIGHTS = [
  // floors 1-2
  {common:60,uncommon:30,rare:10,epic:0,legendary:0},
  // floors 3-4
  {common:30,uncommon:35,rare:25,epic:10,legendary:0},
  // floors 5-6
  {common:10,uncommon:25,rare:35,epic:25,legendary:5},
  // floors 7-8+
  {common:5,uncommon:15,rare:25,epic:35,legendary:5},
];

export function rollGearDrop(floor){
  var tier=Math.min(3,Math.floor((floor-1)/2));
  var w=DROP_WEIGHTS[tier];
  var roll=Math.random()*100;
  var rarity;
  if(roll<w.common)rarity='common';
  else if(roll<w.common+w.uncommon)rarity='uncommon';
  else if(roll<w.common+w.uncommon+w.rare)rarity='rare';
  else if(roll<w.common+w.uncommon+w.rare+w.epic)rarity='epic';
  else rarity='legendary';
  var pool=Object.keys(ITEMS).filter(function(k){return ITEMS[k].rarity===rarity});
  if(pool.length===0)pool=Object.keys(ITEMS).filter(function(k){return ITEMS[k].rarity==='common'});
  return pool[Math.floor(Math.random()*pool.length)];
}
