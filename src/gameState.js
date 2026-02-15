// =============== CENTRAL MUTABLE STATE ===============
// Zero imports — breaks all circular dependency chains.
// Every module imports this. All mutable globals live here.

export var FIXED_BASE_STATS = {
  hp: 3500, baseDmg: 60, baseAS: 0.5, def: 15, evasion: 0,
  moveSpeed: 100, mana: 0, manaRegen: 0, energy: 0,
  energyRegen: 0, spellDmgBonus: 0
};

export const state = {
  // Battle speed & timing
  spd: 2,
  intv: null,
  bt: 0,
  over: false,

  // VFX arrays
  particles: [],
  projectiles: [],
  floats: [],

  // Heroes
  h1: null,
  h2: null,

  // Class selection
  p1Class: 'custom',
  p2Class: 'ranger',

  // Canvas (initialized in main.js)
  canvas: null,
  ctx: null,

  // Combat log
  logs: [],

  // Ground & ambient rendering
  groundTiles: null,
  ambientParticles: [],

  // Custom character
  customChar: {
    name: 'Custom',
    equipment: { weapon: null, helmet: null, chest: null, boots: null, accessory: null },
    skills: [null, null],
    ultimate: null,
    baseStats: {
      hp: 3500, baseDmg: 60, baseAS: 0.5, def: 15, evasion: 0,
      moveSpeed: 100, mana: 0, manaRegen: 0, energy: 0,
      energyRegen: 0, spellDmgBonus: 0
    },
    sprite: 'wizard',
    editingSide: null
  },

  // Gear bag (unequipped gear the player owns)
  gearBag: [],

  // Follower collections (single-player)
  p1Collection: [],

  // Follower assignments
  p1StakedFollower: null,

  // Online arena
  playerId: null,
  playerName: null,
  onlineOpponents: [],
  selectedOpponent: null,

  // Dungeon
  dgRun: null,

  // Ladder
  ladderRun: null,
  ladderBest: 0,
  _ladderGenConfig: null,
  _showWinFn: null,
};
