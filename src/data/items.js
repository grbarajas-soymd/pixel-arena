// =============== ITEMS DATABASE ===============

export const ITEMS = {
  arcane_staff:{slot:'weapon',icon:'\u{1FA84}',name:'Arcane Staff',stats:{baseDmg:95,baseAS:0.75},desc:'+95Dmg 0.75AS'},
  crystal_staff:{slot:'weapon',icon:'\u{1F52E}',name:'Crystal Staff',stats:{baseDmg:120,baseAS:0.65},desc:'+120Dmg 0.65AS'},
  longbow:{slot:'weapon',icon:'\u{1F3F9}',name:'Flame Longbow',stats:{baseDmg:205,baseAS:1.0},desc:'+205Dmg 1.0AS'},
  shortbow:{slot:'weapon',icon:'\u{1F3F9}',name:'Swift Shortbow',stats:{baseDmg:140,baseAS:1.4},desc:'+140Dmg 1.4AS'},
  frost_daggers:{slot:'weapon',icon:'\u{1F5E1}',name:'Frost Daggers',stats:{baseDmg:175,baseAS:1.4},desc:'+175Dmg 1.4AS'},
  war_axe:{slot:'weapon',icon:'\u{1FA93}',name:'Blood War Axe',stats:{baseDmg:230,baseAS:0.85},desc:'+230Dmg 0.85AS'},
  great_sword:{slot:'weapon',icon:'\u2694',name:'Greatsword',stats:{baseDmg:260,baseAS:0.7},desc:'+260Dmg 0.7AS'},
  cursed_scythe:{slot:'weapon',icon:'\u26B0',name:'Cursed Scythe',stats:{baseDmg:200,baseAS:0.95},desc:'+200Dmg 0.95AS'},
  steel_helm:{slot:'helmet',icon:'\u26D1',name:'Steel Helm',stats:{def:15,hp:200},desc:'+15DEF +200HP'},
  mage_crown:{slot:'helmet',icon:'\u{1F451}',name:'Arcane Crown',stats:{def:5,mana:100,spellDmgBonus:0.05},desc:'+100Mana +5%Spell'},
  shadow_hood:{slot:'helmet',icon:'\u{1F3AD}',name:'Shadow Hood',stats:{def:8,evasion:0.05,moveSpeed:10},desc:'+5%Eva +10Spd'},
  berserker_helm:{slot:'helmet',icon:'\u{1F480}',name:'Berserker Helm',stats:{def:10,hp:400},desc:'+10DEF +400HP'},
  dragon_helm:{slot:'helmet',icon:'\u{1F409}',name:'Dragon Helm',stats:{def:20,hp:300},desc:'+20DEF +300HP'},
  plate_armor:{slot:'chest',icon:'\u{1F6E1}',name:'Plate Armor',stats:{def:30,hp:500,moveSpeed:-10},desc:'+30DEF +500HP -10Spd'},
  mage_robe:{slot:'chest',icon:'\u{1F9E5}',name:'Arcane Robe',stats:{def:10,mana:150,manaRegen:2},desc:'+150Mana +2/s'},
  leather_vest:{slot:'chest',icon:'\u{1F9BA}',name:'Leather Vest',stats:{def:15,evasion:0.08,moveSpeed:15},desc:'+8%Eva +15Spd'},
  chain_mail:{slot:'chest',icon:'\u26D3',name:'Chain Mail',stats:{def:22,hp:300},desc:'+22DEF +300HP'},
  blood_plate:{slot:'chest',icon:'\u2764',name:'Blood Plate',stats:{def:25,hp:800},desc:'+25DEF +800HP'},
  steel_boots:{slot:'boots',icon:'\u{1F97E}',name:'Steel Boots',stats:{def:8,moveSpeed:10},desc:'+8DEF +10Spd'},
  swift_boots:{slot:'boots',icon:'\u{1F45F}',name:'Swift Boots',stats:{def:3,moveSpeed:40,evasion:0.03},desc:'+40Spd +3%Eva'},
  war_treads:{slot:'boots',icon:'\u{1F9B6}',name:'War Treads',stats:{def:12,moveSpeed:25,hp:150},desc:'+12DEF +25Spd'},
  power_ring:{slot:'accessory',icon:'\u{1F48D}',name:'Ring of Power',stats:{baseDmg:30},desc:'+30Dmg'},
  life_amulet:{slot:'accessory',icon:'\u{1F4FF}',name:'Life Amulet',stats:{hp:600},desc:'+600HP'},
  speed_charm:{slot:'accessory',icon:'\u26A1',name:'Speed Charm',stats:{baseAS:0.15,moveSpeed:15},desc:'+0.15AS +15Spd'},
  mana_crystal:{slot:'accessory',icon:'\u{1F48E}',name:'Mana Crystal',stats:{mana:200,manaRegen:3},desc:'+200Mana +3/s'},
  shadow_cloak:{slot:'accessory',icon:'\u{1F311}',name:'Shadow Cloak',stats:{evasion:0.10,def:5},desc:'+10%Eva +5DEF'},
  berserker_totem:{slot:'accessory',icon:'\u{1F9B4}',name:'Berserker Totem',stats:{baseDmg:40,hp:300},desc:'+40Dmg +300HP'},
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
