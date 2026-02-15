// =============== CONSTANTS ===============
// Canvas dimensions, timing, and combat constants.

export const CW = 1000;
export const CH = 500;
export const AX = 40;
export const AY = 60;
export const AW = 920;
export const AH = 370;
export const GY = AY + AH - 30;
export const TK = 50;
export const MELEE = 55;
export const RANGED_PEN = 0.7;

// Ladder constants
export const LADDER_SEQUENCE = ['wizard', 'ranger', 'assassin', 'barbarian'];
export const LADDER_NAMES = [
  'Draven','Zara','Krix','Moku','Thane','Vex','Nira','Bolt','Crag','Syla',
  'Fenn','Hex','Jolt','Pyra','Onyx','Dusk','Blaze','Storm','Frost','Ash',
  'Rune','Shade','Grim','Talon','Echo','Ember','Flux','Nova','Spike','Wisp'
];

// Dungeon monsters
export const DG_MONSTERS = [
  // floor 1-2
  {name:'Goblin Scout',icon:'👺',hp:400,dmg:45,def:8,tier:1},
  {name:'Cave Bat',icon:'🦇',hp:280,dmg:60,def:3,tier:1},
  {name:'Slime',icon:'🟢',hp:550,dmg:35,def:12,tier:1},
  {name:'Skeleton',icon:'💀',hp:450,dmg:55,def:10,tier:1},
  // floor 3-4
  {name:'Orc Warrior',icon:'👹',hp:800,dmg:85,def:22,tier:2},
  {name:'Dark Mage',icon:'🧙',hp:600,dmg:115,def:12,tier:2},
  {name:'Troll',icon:'🧌',hp:1100,dmg:75,def:30,tier:2},
  {name:'Ghost',icon:'👻',hp:550,dmg:100,def:8,tier:2,evasion:0.2},
  // floor 5-6
  {name:'Minotaur',icon:'🐂',hp:1500,dmg:125,def:35,tier:3},
  {name:'Lich',icon:'☠️',hp:1000,dmg:155,def:18,tier:3},
  {name:'Stone Golem',icon:'🗿',hp:2000,dmg:95,def:55,tier:3},
  {name:'Wyvern',icon:'🐉',hp:1200,dmg:145,def:25,tier:3},
  // floor 7+
  {name:'Dragon',icon:'🐲',hp:2800,dmg:185,def:45,tier:4},
  {name:'Demon Lord',icon:'😈',hp:2400,dmg:210,def:40,tier:4},
  {name:'Ancient Wyrm',icon:'🐍',hp:3500,dmg:165,def:50,tier:4},
];

export const DG_ROOM_TYPES = ['combat','combat','combat','treasure','trap','rest','shrine','merchant','follower_cage'];
