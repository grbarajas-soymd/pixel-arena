// =============== CENTRAL MUTABLE STATE ===============
// Zero imports — breaks all circular dependency chains.
// Every module imports this. All mutable globals live here.

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
  p1Class: 'wizard',
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
      hp: 4500, baseDmg: 0, baseAS: 0, def: 0, evasion: 0,
      moveSpeed: 110, mana: 0, manaRegen: 0, energy: 0,
      energyRegen: 0, spellDmgBonus: 0
    },
    rangeType: 'ranged',
    sprite: 'wizard',
    editingSide: null
  },

  // Follower collections
  p1Collection: [],
  p2Collection: [],
  p1Stash: [],
  p2Stash: [],

  // Follower assignments
  p1StakedFollower: null,
  p2StakedFollower: null,
  p1FighterFollowers: [],
  p2FighterFollowers: [],

  // Dungeon
  dungeonPlayer: 1,
  dgClass: 'wizard',
  dgRun: null,

  // Ladder
  ladderPlayer: 1,
  ladderClass: 'wizard',
  ladderRun: null,
  ladderBestP1: 0,
  ladderBestP2: 0,
  _ladderGenConfig: null,
  _showWinFn: null,
};
