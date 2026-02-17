// =============== CONSTANTS ===============
// Canvas dimensions, timing, and combat constants.

export const CW = 1000;
export const CH = 500;
export const AX = 40;
export const AY = 60;
export const AW = 920;
export const AH = 370;
export const GY = AY + AH - 30;
export const GY_MIN = GY - 80;   // Back of arena (depth)
export const GY_MAX = GY + 30;   // Front of arena
export const STRAFE_SPEED = 0.35; // Y-speed as fraction of moveSpeed
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

