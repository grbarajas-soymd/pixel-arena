// =============== STATUS EFFECTS REGISTRY ===============
// Single source of truth for all status effect metadata.
// Both combat systems (real-time arena and turn-based dungeon) read from this
// registry to display consistent names, icons, colors, and descriptions.
// Categories map to CATEGORY_COLORS for border/background styling.

export const STATUS_EFFECTS = {
  // === Crowd Control (Gold) ===
  stunned:      { name:'Stunned',       icon:'\uD83D\uDCAB', color:'#ffcc22', category:'cc',      desc:'Cannot act this turn.' },
  frozen:       { name:'Frozen',        icon:'\u2744',        color:'#44aaff', category:'cc',      desc:'Frozen solid. Cannot act.' },

  // === Debuffs (Red/Orange) ===
  shocked:      { name:'Shocked',       icon:'\u26A1',        color:'#44ddbb', category:'debuff',  desc:'+10% damage taken. Frost Nova freeze combo.' },
  poison:       { name:'Poison',        icon:'\u2620',        color:'#88cc44', category:'debuff',  desc:'Taking poison damage each turn.' },
  burn:         { name:'Burning',       icon:'\uD83D\uDD25',  color:'#ff6622', category:'debuff',  desc:'Taking fire damage each turn.' },
  bleed:        { name:'Bleed',         icon:'\uD83E\uDE78',  color:'#aa5a3a', category:'debuff',  desc:'Bleeding. Taking damage over time.' },
  frostSlow:    { name:'Chilled',       icon:'\u2744',        color:'#88ccff', category:'debuff',  desc:'Movement and attack speed reduced.' },
  marked:       { name:'Marked',        icon:'\uD83C\uDFAF',  color:'#ff8844', category:'debuff',  desc:'Evasion reduced. Next hit guaranteed.' },
  vulnerable:   { name:'Vulnerable',    icon:'\uD83D\uDCA2',  color:'#ff6644', category:'debuff',  desc:'Takes increased damage from all sources.' },
  deathMark:    { name:'Death Mark',    icon:'\u2620',        color:'#ff8800', category:'debuff',  desc:'Damage stored. Detonates when mark expires.' },
  warcry:       { name:'Weakened',      icon:'\uD83D\uDCE2',  color:'#ffaa44', category:'debuff',  desc:'Attack power reduced by War Cry.' },
  enraged:      { name:'Enraged',       icon:'\uD83D\uDCA2',  color:'#ff4444', category:'debuff',  desc:'Monster enraged. +50% damage.' },
  monsterPoison:{ name:'Poisoned',      icon:'\u2620',        color:'#88cc44', category:'debuff',  desc:'Poisoned. Taking damage each turn.' },

  // === Defensive Buffs (Blue/Teal) ===
  shield:       { name:'Shield',        icon:'\uD83D\uDEE1\uFE0F', color:'#44ddbb', category:'defense', desc:'Absorbs incoming damage.' },
  stealth:      { name:'Stealth',       icon:'\uD83D\uDCA8',  color:'#6a9aba', category:'defense', desc:'Hidden. Next attack deals 3x damage.' },
  smokeBomb:    { name:'Smoke Bomb',    icon:'\uD83D\uDCA3',  color:'#667788', category:'defense', desc:'Evasion greatly increased.' },
  riposte:      { name:'Riposte',       icon:'\uD83D\uDEE1',  color:'#ccccff', category:'defense', desc:'Counter-attacks when hit.' },
  thorns:       { name:'Thorns',        icon:'\uD83C\uDF31',  color:'#44cc44', category:'defense', desc:'Reflects a portion of damage taken.' },
  lastStand:    { name:'Last Stand',    icon:'\u2694\uFE0F',   color:'#ffcc22', category:'defense', desc:'Cannot die. Heals when buff expires.' },
  invuln:       { name:'Invulnerable',  icon:'\uD83D\uDD25',  color:'#ff8833', category:'defense', desc:'Immune to all damage.' },

  // === Offensive Buffs (Red/Purple) ===
  bloodlust:    { name:'Bloodlust',     icon:'\uD83E\uDE78',  color:'#cc3300', category:'offense', desc:'Extra attack. Heals on expiry.' },
  trance:       { name:'Battle Trance', icon:'\uD83D\uDD25',  color:'#ff4444', category:'offense', desc:'Defense converted to bonus damage.' },
  envenomed:    { name:'Envenomed',     icon:'\u2620',        color:'#88cc44', category:'offense', desc:'Attacks apply poison to enemies.' },

  // === Ultimate Buffs (Purple/Gold) ===
  berserk:      { name:'Berserker',     icon:'\uD83D\uDC80',  color:'#ff4444', category:'ult',     desc:'Massively increased damage.' },
  primalFury:   { name:'Primal Fury',   icon:'\uD83D\uDC3B',  color:'#ff6622', category:'ult',     desc:'Extra attacks. Hits apply poison.' },
  shadowDance:  { name:'Shadow Dance',  icon:'\uD83C\uDF11',  color:'#6644aa', category:'ult',     desc:'Persistent stealth. Attacks stay hidden.' },
  freeSpells:   { name:'Free Spells',   icon:'\u2728',        color:'#aa88ff', category:'ult',     desc:'All spells cost no resources.' },
};

// Visual grouping for status pill borders and backgrounds in dungeon canvas UI
export const CATEGORY_COLORS = {
  cc:      { border:'#ffcc22', bg:'rgba(200,168,72,0.25)' },
  debuff:  { border:'#cc4444', bg:'rgba(180,60,40,0.2)' },
  defense: { border:'#44aacc', bg:'rgba(60,140,180,0.2)' },
  offense: { border:'#cc4444', bg:'rgba(180,60,40,0.15)' },
  ult:     { border:'#aa66cc', bg:'rgba(140,80,180,0.25)' },
};
