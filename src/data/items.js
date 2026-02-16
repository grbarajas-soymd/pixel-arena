// =============== ITEMS DATABASE ===============

export const GEAR_RARITY_COLORS = {
  starter:'#6a6a5a',
  common:'#8a8a7a',
  uncommon:'#4a8a4a',
  rare:'#4a6a9a',
  epic:'#8a4a9a',
  legendary:'#c8a848',
};

export const ITEMS = {
  // — Starter (never drops, only starting equipment) —
  rusty_blade:{slot:'weapon',icon:'\u{1F5E1}',name:'Rusty Blade',rarity:'starter',rangeType:'melee',stats:{baseDmg:50,baseAS:0.35},desc:'+50Dmg 0.35AS',visual:{type:'sword',color:'#5a4a3a',hilight:'#7a6a5a'}},
  wooden_bow:{slot:'weapon',icon:'\u{1F3F9}',name:'Wooden Bow',rarity:'starter',rangeType:'ranged',stats:{baseDmg:40,baseAS:0.45},desc:'+40Dmg 0.45AS',visual:{type:'bow',color:'#5a3a1a',hilight:'#7a5a3a'}},
  worn_wand:{slot:'weapon',icon:'\u{1FA84}',name:'Worn Wand',rarity:'starter',rangeType:'ranged',stats:{baseDmg:30,baseAS:0.3,mana:80,spellDmgBonus:0.06},desc:'+30Dmg 0.3AS +80Mana +6%Spell',visual:{type:'staff',color:'#4a4a3a',hilight:'#6a6a5a',glow:'#6aaa8a'}},
  cloth_cap:{slot:'helmet',icon:'\u{1F9E2}',name:'Cloth Cap',rarity:'starter',stats:{def:5,hp:100},desc:'+5DEF +100HP',visual:{type:'cloth_cap',color:'#5a5a4a',hilight:'#7a7a6a'}},
  cloth_tunic:{slot:'chest',icon:'\u{1F455}',name:'Cloth Tunic',rarity:'starter',stats:{def:8,hp:150},desc:'+8DEF +150HP',visual:{type:'cloth',color:'#5a5a4a',hilight:'#7a7a6a'}},
  worn_sandals:{slot:'boots',icon:'\u{1FA74}',name:'Worn Sandals',rarity:'starter',stats:{def:2,moveSpeed:8},desc:'+2DEF +8Spd',visual:{type:'sandals',color:'#5a4a3a',hilight:'#7a6a5a'}},
  copper_ring:{slot:'accessory',icon:'\u{1F48D}',name:'Copper Ring',rarity:'starter',stats:{baseDmg:10,hp:50},desc:'+10Dmg +50HP',visual:{type:'ring',color:'#7a5a3a',hilight:'#9a7a5a'}},
  rusty_daggers:{slot:'weapon',icon:'\u{1F5E1}',name:'Rusty Daggers',rarity:'starter',rangeType:'melee',stats:{baseDmg:35,baseAS:0.55,evasion:0.03},desc:'+35Dmg 0.55AS +3%Eva',visual:{type:'daggers',color:'#5a5a5a',hilight:'#7a7a7a'}},

  // — Common —
  arcane_staff:{slot:'weapon',icon:'\u{1FA84}',name:'Arcane Staff',rarity:'common',rangeType:'ranged',stats:{baseDmg:55,baseAS:0.55,spellDmgBonus:0.08},desc:'+55Dmg 0.55AS +8%Spell',visual:{type:'staff',color:'#3a4a5a',hilight:'#5a6a7a',glow:'#6aaa8a'}},
  steel_helm:{slot:'helmet',icon:'\u26D1',name:'Steel Helm',rarity:'common',stats:{def:15,hp:200},desc:'+15DEF +200HP',visual:{type:'steel_helm',color:'#5a5a5a',hilight:'#7a7a7a'}},
  chain_mail:{slot:'chest',icon:'\u26D3',name:'Chain Mail',rarity:'common',stats:{def:22,hp:300},desc:'+22DEF +300HP',visual:{type:'chain',color:'#5a5a5a',hilight:'#7a7a7a'}},
  steel_boots:{slot:'boots',icon:'\u{1F97E}',name:'Steel Boots',rarity:'common',stats:{def:8,moveSpeed:10},desc:'+8DEF +10Spd',visual:{type:'steel_boots',color:'#4a4a4a',hilight:'#6a6a6a'}},
  power_ring:{slot:'accessory',icon:'\u{1F48D}',name:'Ring of Power',rarity:'common',stats:{baseDmg:30},desc:'+30Dmg',visual:{type:'ring',color:'#6a3a3a',hilight:'#8a5a5a',glow:'#aa5a5a'}},

  // — Uncommon —
  crystal_staff:{slot:'weapon',icon:'\u{1F52E}',name:'Crystal Staff',rarity:'uncommon',rangeType:'ranged',stats:{baseDmg:80,baseAS:0.6,spellDmgBonus:0.12},desc:'+80Dmg 0.6AS +12%Spell',visual:{type:'staff',color:'#4a6a8a',hilight:'#6a9aba',glow:'#88bbdd'}},
  shortbow:{slot:'weapon',icon:'\u{1F3F9}',name:'Swift Shortbow',rarity:'uncommon',rangeType:'ranged',stats:{baseDmg:60,baseAS:0.8},desc:'+60Dmg 0.8AS',visual:{type:'bow',color:'#6a4a2a',hilight:'#8a6a4a'}},
  shadow_hood:{slot:'helmet',icon:'\u{1F3AD}',name:'Shadow Hood',rarity:'uncommon',stats:{def:8,evasion:0.05,moveSpeed:10},desc:'+5%Eva +10Spd',visual:{type:'shadow_hood',color:'#2a2a3a',hilight:'#3a3a4a'}},
  leather_vest:{slot:'chest',icon:'\u{1F9BA}',name:'Leather Vest',rarity:'uncommon',stats:{def:15,evasion:0.08,moveSpeed:15},desc:'+8%Eva +15Spd',visual:{type:'leather',color:'#5a3a2a',hilight:'#7a5a4a'}},
  swift_boots:{slot:'boots',icon:'\u{1F45F}',name:'Swift Boots',rarity:'uncommon',stats:{def:3,moveSpeed:40,evasion:0.03},desc:'+40Spd +3%Eva',visual:{type:'swift_boots',color:'#5a3a2a',hilight:'#7a5a4a'}},
  speed_charm:{slot:'accessory',icon:'\u26A1',name:'Speed Charm',rarity:'uncommon',stats:{baseAS:0.15,moveSpeed:15},desc:'+0.15AS +15Spd',visual:{type:'charm',color:'#5a6a4a',hilight:'#7a8a6a'}},

  // — Rare —
  frost_daggers:{slot:'weapon',icon:'\u{1F5E1}',name:'Frost Daggers',rarity:'rare',rangeType:'melee',stats:{baseDmg:100,baseAS:0.85},desc:'+100Dmg 0.85AS',visual:{type:'daggers',color:'#6a8aaa',hilight:'#8aaacc'}},
  cursed_scythe:{slot:'weapon',icon:'\u26B0',name:'Cursed Scythe',rarity:'rare',rangeType:'melee',stats:{baseDmg:130,baseAS:0.65},desc:'+130Dmg 0.65AS',visual:{type:'scythe',color:'#3a2a3a',hilight:'#5a4a5a',glow:'#6a4a8a'}},
  mage_crown:{slot:'helmet',icon:'\u{1F451}',name:'Arcane Crown',rarity:'rare',stats:{def:5,mana:100,spellDmgBonus:0.05},desc:'+100Mana +5%Spell',visual:{type:'crown',color:'#4a6a8a',hilight:'#6a8aaa',glow:'#6aaa8a'}},
  berserker_helm:{slot:'helmet',icon:'\u{1F480}',name:'Berserker Helm',rarity:'rare',stats:{def:10,hp:400},desc:'+10DEF +400HP',visual:{type:'berserker_helm',color:'#4a2a2a',hilight:'#6a4a4a'}},
  mage_robe:{slot:'chest',icon:'\u{1F9E5}',name:'Arcane Robe',rarity:'rare',stats:{def:10,mana:150,manaRegen:2},desc:'+150Mana +2/s',visual:{type:'robe',color:'#3a4a5a',hilight:'#5a6a7a',glow:'#6aaa8a'}},
  plate_armor:{slot:'chest',icon:'\u{1F6E1}',name:'Plate Armor',rarity:'rare',stats:{def:30,hp:500,moveSpeed:-10},desc:'+30DEF +500HP -10Spd',visual:{type:'plate',color:'#4a4a4a',hilight:'#6a6a6a'}},
  war_treads:{slot:'boots',icon:'\u{1F9B6}',name:'War Treads',rarity:'rare',stats:{def:12,moveSpeed:25,hp:150},desc:'+12DEF +25Spd',visual:{type:'war_treads',color:'#3a2a2a',hilight:'#5a4a4a'}},
  shadow_cloak:{slot:'accessory',icon:'\u{1F311}',name:'Shadow Cloak',rarity:'rare',stats:{evasion:0.10,def:5},desc:'+10%Eva +5DEF',visual:{type:'cloak',color:'#2a2a3a',hilight:'#3a3a4a'}},
  mana_crystal:{slot:'accessory',icon:'\u{1F48E}',name:'Mana Crystal',rarity:'rare',stats:{mana:200,manaRegen:3},desc:'+200Mana +3/s',visual:{type:'crystal',color:'#4a6a8a',hilight:'#6a8aaa',glow:'#88bbdd'}},

  // — Epic —
  longbow:{slot:'weapon',icon:'\u{1F3F9}',name:'Flame Longbow',rarity:'epic',rangeType:'ranged',stats:{baseDmg:170,baseAS:0.85},desc:'+170Dmg 0.85AS',visual:{type:'bow',color:'#8a4a1a',hilight:'#aa6a3a',glow:'#c87a4a'}},
  war_axe:{slot:'weapon',icon:'\u{1FA93}',name:'Blood War Axe',rarity:'epic',rangeType:'melee',stats:{baseDmg:195,baseAS:0.7},desc:'+195Dmg 0.7AS',visual:{type:'axe',color:'#5a2a2a',hilight:'#7a4a4a'}},
  dragon_helm:{slot:'helmet',icon:'\u{1F409}',name:'Dragon Helm',rarity:'epic',stats:{def:20,hp:300},desc:'+20DEF +300HP',visual:{type:'horned_helm',color:'#5a3a2a',hilight:'#7a5a4a'}},
  blood_plate:{slot:'chest',icon:'\u2764',name:'Blood Plate',rarity:'epic',stats:{def:25,hp:800},desc:'+25DEF +800HP',visual:{type:'blood_plate',color:'#4a1a1a',hilight:'#6a3a3a'}},
  windwalkers:{slot:'boots',icon:'\u{1F4A8}',name:'Windwalkers',rarity:'epic',stats:{def:6,moveSpeed:55,evasion:0.06},desc:'+55Spd +6%Eva',visual:{type:'windwalkers',color:'#3a4a3a',hilight:'#5a6a5a',glow:'#6aaa8a'}},
  life_amulet:{slot:'accessory',icon:'\u{1F4FF}',name:'Life Amulet',rarity:'epic',stats:{hp:600},desc:'+600HP',visual:{type:'amulet',color:'#6a5a2a',hilight:'#8a7a4a',glow:'#c8a848'}},
  berserker_totem:{slot:'accessory',icon:'\u{1F9B4}',name:'Berserker Totem',rarity:'epic',stats:{baseDmg:40,hp:300},desc:'+40Dmg +300HP',visual:{type:'totem',color:'#5a3a2a',hilight:'#7a5a4a'}},

  // — Legendary —
  great_sword:{slot:'weapon',icon:'\u2694',name:'Greatsword',rarity:'legendary',rangeType:'melee',stats:{baseDmg:250,baseAS:0.85},desc:'+250Dmg 0.85AS',visual:{type:'sword',color:'#5a5a6a',hilight:'#7a7a8a',glow:'#c8a848'}},
  crown_of_abyss:{slot:'helmet',icon:'\u{1F451}',name:'Crown of the Abyss',rarity:'legendary',stats:{def:25,hp:500,spellDmgBonus:0.10},desc:'+25DEF +500HP +10%Spell',visual:{type:'crown',color:'#3a2a4a',hilight:'#5a4a6a',glow:'#6a4a8a'}},
  dragonscale:{slot:'chest',icon:'\u{1F432}',name:'Dragonscale',rarity:'legendary',stats:{def:40,hp:1000,moveSpeed:-5},desc:'+40DEF +1000HP -5Spd',visual:{type:'dragonscale',color:'#2a4a2a',hilight:'#4a6a4a',glow:'#c8a848'}},
  stormstriders:{slot:'boots',icon:'\u26A1',name:'Stormstriders',rarity:'legendary',stats:{def:10,moveSpeed:65,evasion:0.08,baseAS:0.1},desc:'+65Spd +8%Eva +0.1AS',visual:{type:'stormstriders',color:'#3a3a5a',hilight:'#5a5a7a',glow:'#6a9aba'}},
  heart_of_chaos:{slot:'accessory',icon:'\u{1F525}',name:'Heart of Chaos',rarity:'legendary',stats:{baseDmg:55,hp:400,baseAS:0.1},desc:'+55Dmg +400HP +0.1AS',visual:{type:'heart',color:'#6a1a1a',hilight:'#8a3a3a',glow:'#aa2a2a'}},
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
    sprite: 'ranger', skills: [3, 4], ultimate: 1, name: 'Ranger',
  },
  caster: {
    equipment: { weapon:'worn_wand', helmet:'cloth_cap', chest:'cloth_tunic', boots:'worn_sandals', accessory:'copper_ring' },
    sprite: 'wizard', skills: [0, 2], ultimate: 0, name: 'Mage',
  },
  hybrid: {
    equipment: { weapon:'rusty_daggers', helmet:'cloth_cap', chest:'cloth_tunic', boots:'worn_sandals', accessory:'copper_ring' },
    sprite: 'assassin', skills: [6, 7], ultimate: 2, name: 'Rogue',
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

function _rollRarity(w){
  var roll=Math.random()*100;
  if(roll<w.common)return 'common';
  if(roll<w.common+w.uncommon)return 'uncommon';
  if(roll<w.common+w.uncommon+w.rare)return 'rare';
  if(roll<w.common+w.uncommon+w.rare+w.epic)return 'epic';
  return 'legendary';
}

export function rollGearDrop(floor){
  var tier=Math.min(3,Math.floor((floor-1)/2));
  var rarity=_rollRarity(DROP_WEIGHTS[tier]);
  var pool=Object.keys(ITEMS).filter(function(k){return ITEMS[k].rarity===rarity});
  if(pool.length===0)pool=Object.keys(ITEMS).filter(function(k){return ITEMS[k].rarity==='common'});
  return pool[Math.floor(Math.random()*pool.length)];
}

export function rollShopGear(floor){
  var tier=Math.min(3,Math.max(0,Math.floor((floor-3)/2)));
  var rarity=_rollRarity(DROP_WEIGHTS[tier]);
  if(rarity==='epic'||rarity==='legendary')rarity='rare';
  var pool=Object.keys(ITEMS).filter(function(k){return ITEMS[k].rarity===rarity});
  if(pool.length===0)pool=Object.keys(ITEMS).filter(function(k){return ITEMS[k].rarity==='common'});
  return pool[Math.floor(Math.random()*pool.length)];
}
