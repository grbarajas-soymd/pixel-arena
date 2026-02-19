// =============== HERO FACTORY ===============
import { state, FIXED_BASE_STATS } from '../gameState.js';
import { AX, AW, GY, MELEE } from '../constants.js';
import { CLASSES } from '../data/classes.js';
import { ITEMS, resolveGear, gearTemplate, GEAR_RARITY_COLORS } from '../data/items.js';
import { ALL_SKILLS, ALL_ULTS } from '../data/skills.js';

// ---- Shared helpers ----

function clampStats(s) {
  s.hp = Math.max(100, s.hp); s.baseDmg = Math.max(10, s.baseDmg); s.baseAS = Math.max(0.1, s.baseAS);
  s.def = Math.max(0, s.def); s.evasion = Math.max(0, Math.min(0.8, s.evasion)); s.moveSpeed = Math.max(30, s.moveSpeed);
  return s;
}

function accumulateEquipStats(baseStats, equipment) {
  var s = Object.assign({}, baseStats);
  var resolved = {};
  for (var slot in equipment) {
    var g = resolveGear(equipment[slot]);
    if (g && g.stats) {
      resolved[slot] = g;
      for (var k in g.stats) s[k] = (s[k] || 0) + g.stats[k];
    }
  }
  return { stats: clampStats(s), equipment: resolved };
}

function baseHero(side) {
  var isLeft = side === 'left';
  return {
    side: side, x: isLeft ? AX + 140 : AX + AW - 140, y: GY, facing: isLeft ? 1 : -1,
    atkCnt: 0, atkCd: 0, bleedStacks: [],
    shocked: false, shockedEnd: 0, slow: 0, slowEnd: 0, stunEnd: 0,
    state: 'idle', bobPhase: isLeft ? 0 : Math.PI, attackAnim: 0, hurtAnim: 0, castAnim: 0,
    totDmg: 0, totHeal: 0,
    blActive: false, blEnd: 0, blDmg: 0, markNext: false,
    followerAlive: false, follower: null, arenaFollowers: [],
    ultActive: false, ultEnd: 0,
    shieldActive: false, shieldHp: 0, shieldEnd: 0,
    charge: 0, maxCharge: 10, chargeDecayTimer: 0,
    ultStrikes: 0, ultStrikeTimer: 0,
    meleeRange: MELEE, throwRange: 200,
    stealthed: false, stealthEnd: 0, combo: 0, maxCombo: 5,
    envenomed: false, envenomedEnd: 0,
    deathMarkTarget: false, deathMarkEnd: 0, deathMarkDmg: 0,
    smokeBombActive: false, smokeBombEnd: 0, smokeBombX: 0, smokeBombRadius: 120,
  };
}

export function getCustomTotalStats() {
  return accumulateEquipStats(state.customChar.baseStats, state.customChar.equipment).stats;
}

export function getWeaponRangeType() {
  var entry = state.customChar.equipment.weapon;
  var tmpl = gearTemplate(entry);
  if (tmpl && tmpl.rangeType) return tmpl.rangeType;
  return 'melee';
}

export function serializeBuild() {
  var s = getCustomTotalStats();
  return {
    name: state.customChar.name,
    sprite: state.customChar.sprite,
    equipment: Object.assign({}, state.customChar.equipment),
    skills: state.customChar.skills.slice(),
    ultimate: state.customChar.ultimate,
    rangeType: getWeaponRangeType(),
    stats: { hp: s.hp, baseDmg: s.baseDmg, baseAS: s.baseAS, def: s.def, evasion: s.evasion, moveSpeed: s.moveSpeed, power: 200, powerRegen: 8, spellDmgBonus: s.spellDmgBonus || 0 }
  };
}

// Recompute opponent build stats from equipment templates (prevents stale/manipulated stats)
export function resolveOpponentBuild(build) {
  var result = accumulateEquipStats(FIXED_BASE_STATS, build.equipment || {});
  var validSkills = (build.skills || []).map(function(idx) {
    return (idx !== null && ALL_SKILLS[idx]) ? idx : null;
  });
  var validUlt = (build.ultimate !== null && ALL_ULTS[build.ultimate]) ? build.ultimate : null;
  return {
    name: build.name || 'Unknown', sprite: build.sprite || 'wizard',
    equipment: result.equipment, skills: validSkills, ultimate: validUlt,
    rangeType: build.rangeType || 'melee',
    stats: result.stats
  };
}

export function mkHero(classKey, side) {
  // Check for ladder-generated opponent
  if (side === 'right' && state._ladderGenConfig) {
    return mkLadderHero(state._ladderGenConfig, side);
  }
  if (classKey === 'custom') return mkCustomHero(side);
  var c = CLASSES[classKey];
  // Scale down class opponents in ladder mode (they're PvP-tuned, too strong for gear-progression heroes)
  var ls = (side === 'right' && state._ladderMode) ? 0.7 : 1;
  var h = Object.assign(baseHero(side), {
    type: classKey, name: c.nameShort, color: c.color, colorDark: c.colorDark, colorLight: c.colorLight,
    maxHp: Math.round(c.hp * ls), hp: Math.round(c.hp * ls), baseDmg: Math.round(c.baseDmg * ls), baseAS: parseFloat((c.baseAS * ls).toFixed(2)), def: Math.round(c.def * ls), evasion: c.evasion || 0,
    moveSpeed: c.moveSpeed, moveSpeedBonus: c.moveSpeedBonus || 0,
    attackRange: c.attackRange || c.throwRange || 200, preferredRange: c.preferredRange || 200,
    followerMaxHp: c.followerMaxHp || 450,
    mana: c.mana || 0, maxMana: c.mana || 0, manaRegen: c.manaRegen || 0,
    castSpeedBonus: c.castSpeedBonus || 0, spellDmgBonus: c.spellDmgBonus || 0,
    spellRange: c.spellRange || c.throwRange || 200,
    energy: c.energy || 0, maxEnergy: c.energy || 0, energyRegen: c.energyRegen || 0,
    meleeRange: c.meleeRange || MELEE, throwRange: c.throwRange || 200,
    spells: {}
  });
  if (classKey === 'wizard') {
    h.spells = { chainLightning: { cd: 0, bcd: c.chainBcd, cost: c.chainCost, n: "Chain Zap" }, lightningBolt: { cd: 0, bcd: c.boltBcd, cost: c.boltCost, n: "Bolt" }, staticShield: { cd: 0, bcd: c.shieldBcd, cost: c.shieldCost, n: "Shield" }, ultimate: { cd: 0, bcd: 1 / 0, used: false, n: "Storm" } };
  } else if (classKey === 'ranger') {
    h.spells = { huntersMark: { cd: 0, bcd: 8000, n: "Mark" }, bloodlust: { cd: 0, bcd: 12000, n: "Bloodlust" }, sacrifice: { cd: 0, bcd: 15000, n: "Summon" }, ultimate: { cd: 0, bcd: 1 / 0, used: false, n: "Rain of Fire" } };
  } else if (classKey === 'assassin') {
    h.spells = { shadowStep: { cd: 0, bcd: 3500, cost: 25, n: "Step" }, envenom: { cd: 0, bcd: 8000, cost: 30, n: "Envenom" }, smokeBomb: { cd: 0, bcd: 12000, cost: 35, n: "Smoke" }, ultimate: { cd: 0, bcd: 1 / 0, used: false, n: "Death Mark" } };
    h.attackRange = h.throwRange;
  } else if (classKey === 'barbarian') {
    h.spells = { charge: { cd: 0, bcd: c.chargeBcd || 5500, n: "Charge" }, warCry: { cd: 0, bcd: c.warCryBcd || 10000, n: "War Cry" }, ultimate: { cd: 0, bcd: 1 / 0, used: false, n: "Berserker" } };
  }
  return h;
}

function applyCustomSkills(h, skills, ultimate) {
  for (var i = 0; i < 2; i++) {
    if (skills[i] !== null && ALL_SKILLS[skills[i]]) {
      h.spells['skill' + i] = { cd: 0, bcd: ALL_SKILLS[skills[i]].bcd || 3000, n: ALL_SKILLS[skills[i]].name };
      h.customSkillIds.push({ idx: skills[i], key: 'skill' + i });
    }
  }
  if (ultimate !== null && ALL_ULTS[ultimate]) {
    h.spells.ultimate = { cd: 0, bcd: Infinity, used: false, n: ALL_ULTS[ultimate].name };
    h.customUltId = ultimate;
  }
}

export function mkFollower(owner) { return { alive: true, hp: owner.followerMaxHp, maxHp: owner.followerMaxHp, x: owner.x + owner.facing * 40, y: owner.y, moveSpeed: 140, attackRange: MELEE, goading: true, goadRange: 120, bobPhase: Math.random() * 6.28, hurtAnim: 0 } }

export function mkCustomHero(side) {
  var s = getCustomTotalStats(), isMelee = getWeaponRangeType() === 'melee';
  var h = Object.assign(baseHero(side), {
    type: 'custom', customSprite: state.customChar.sprite, name: state.customChar.name,
    color: '#d8b858', colorDark: '#4a3818', colorLight: '#e8d080',
    maxHp: s.hp, hp: s.hp, baseDmg: s.baseDmg, baseAS: s.baseAS, def: s.def, evasion: s.evasion,
    moveSpeed: s.moveSpeed, moveSpeedBonus: 0,
    attackRange: isMelee ? 70 : 350, preferredRange: isMelee ? 50 : 300,
    followerMaxHp: 450,
    mana: 0, maxMana: 0, manaRegen: 0,
    castSpeedBonus: 0, spellDmgBonus: s.spellDmgBonus || 0, spellRange: isMelee ? 200 : 400,
    energy: 0, maxEnergy: 0, energyRegen: 0,
    resource: 200, maxResource: 200, resourceRegen: 8,
    spells: {}, customSkillIds: [], customUltId: null
  });
  // Copy equipment for gear-dependent sprite rendering
  h.equipment = {};
  for (var ek in state.customChar.equipment) { h.equipment[ek] = state.customChar.equipment[ek]; }
  applyCustomSkills(h, state.customChar.skills, state.customChar.ultimate);
  return h;
}

export function mkLadderHero(cfg, side) {
  var isMelee = cfg.rangeType === 'melee';
  var h = Object.assign(baseHero(side), {
    type: 'custom', customSprite: cfg.sprite, name: cfg.name,
    color: '#d8b858', colorDark: '#4a3818', colorLight: '#e8d080',
    maxHp: cfg.hp, hp: cfg.hp, baseDmg: cfg.baseDmg, baseAS: cfg.baseAS, def: cfg.def, evasion: cfg.evasion,
    moveSpeed: cfg.moveSpeed, moveSpeedBonus: 0,
    attackRange: isMelee ? 70 : 350, preferredRange: isMelee ? 50 : 300,
    followerMaxHp: 450,
    mana: 0, maxMana: 0, manaRegen: 0,
    castSpeedBonus: 0, spellDmgBonus: 0, spellRange: isMelee ? 200 : 400,
    energy: 0, maxEnergy: 0, energyRegen: 0,
    resource: 200, maxResource: 200, resourceRegen: 8,
    spells: {}, customSkillIds: [], customUltId: null,
  });
  // Copy equipment for gear-dependent sprite rendering
  if (cfg.equip) { h.equipment = {}; for (var ek in cfg.equip) h.equipment[ek] = cfg.equip[ek]; }
  applyCustomSkills(h, cfg.skills, cfg.ultimate);
  return h;
}

// Monster sprite mapping by tier/type keywords
var MONSTER_SPRITES = {
  'Goblin': 'barbarian', 'Orc': 'barbarian', 'Troll': 'barbarian', 'Minotaur': 'barbarian',
  'Skeleton': 'assassin', 'Ghost': 'assassin', 'Golem': 'assassin',
  'Bat': 'ranger', 'Wyvern': 'ranger', 'Dragon': 'ranger', 'Wyrm': 'ranger',
  'Mage': 'wizard', 'Lich': 'wizard', 'Demon': 'wizard',
  'Slime': 'barbarian',
};

function getMonsterSprite(name) {
  for (var key in MONSTER_SPRITES) {
    if (name.indexOf(key) >= 0) return MONSTER_SPRITES[key];
  }
  return 'barbarian';
}

export function mkDungeonMonster(m, side) {
  return Object.assign(baseHero(side), {
    type: 'custom', monsterType: m.monsterType || 'humanoid',
    monsterColors: m.colors || null,
    name: m.name, monsterIcon: m.icon,
    color: '#ff4444', colorDark: '#6a1a1a', colorLight: '#ff8888',
    maxHp: m.hp, hp: m.hp,
    baseDmg: m.dmg, baseAS: 0.8 + (m.tier - 1) * 0.15,
    def: m.def, evasion: m.evasion || 0,
    moveSpeed: 70 + m.tier * 10, moveSpeedBonus: 0,
    attackRange: 70, preferredRange: 50,
    followerMaxHp: 0,
    mana: 0, maxMana: 0, manaRegen: 0,
    castSpeedBonus: 0, spellDmgBonus: 0, spellRange: 200,
    energy: 0, maxEnergy: 0, energyRegen: 0,
    resource: 0, maxResource: 0, resourceRegen: 0,
    spells: {}, customSkillIds: [], customUltId: null,
  });
}

export function mkDungeonHero(run, side) {
  var isMelee = getWeaponRangeType() === 'melee';
  var s = getCustomTotalStats();
  var h = Object.assign(baseHero(side), {
    type: 'custom', customSprite: state.customChar.sprite,
    name: run.heroName, color: '#d8b858', colorDark: '#4a3818', colorLight: '#e8d080',
    maxHp: run.maxHp, hp: run.hp,
    baseDmg: run.baseDmg + run.bonusDmg,
    baseAS: run.baseAS + run.bonusAS,
    def: run.def + run.bonusDef,
    evasion: run.evasion,
    moveSpeed: s.moveSpeed + (run.moveSpeed || 0), moveSpeedBonus: 0,
    attackRange: isMelee ? 70 : 350, preferredRange: isMelee ? 50 : 300,
    followerMaxHp: 450,
    mana: 0, maxMana: 0, manaRegen: 0,
    castSpeedBonus: 0, spellDmgBonus: s.spellDmgBonus || 0,
    spellRange: isMelee ? 200 : 400,
    energy: 0, maxEnergy: 0, energyRegen: 0,
    resource: 200 + (run.bonusPower || 0), maxResource: 200 + (run.bonusPower || 0), resourceRegen: 8,
    spells: {}, customSkillIds: [], customUltId: null,
    _stashCrit: run._crit || 0,
    _stashLifesteal: run._lifesteal || 0,
  });
  // Copy equipment for gear-dependent sprite rendering
  h.equipment = {};
  for (var ek in state.customChar.equipment) { h.equipment[ek] = state.customChar.equipment[ek]; }
  applyCustomSkills(h, state.customChar.skills, state.customChar.ultimate);
  return h;
}

export function mkArenaFollower(template, owner, idx, total) {
  var isLeft = owner.side === 'left';
  var spacing = 45;
  var baseX = owner.x + (isLeft ? -60 : 60);
  var xJitter = idx * spacing * (isLeft ? -1 : 1);
  var offsetY = (idx - (total - 1) / 2) * 20;
  return {
    alive: true, name: template.name, icon: template.icon, rarity: template.rarity,
    _upgrades: template.upgrades || 0,
    color: GEAR_RARITY_COLORS[template.rarity] || '#aaa',
    hp: template.combatHp, maxHp: template.combatHp,
    baseDmg: template.combatDmg, baseAS: template.combatAS, def: template.combatDef,
    attackRange: template.combatRange || 60,
    moveSpeed: 100 + (template.rarity === 'legendary' ? 30 : template.rarity === 'epic' ? 20 : template.rarity === 'rare' ? 10 : 0),
    x: baseX + xJitter, y: GY + offsetY, ownerSide: owner.side,
    bobPhase: Math.random() * 6.28, hurtAnim: 0, attackAnim: 0, atkCd: 0, totDmg: 0,
    isRanged: (template.combatRange || 60) > 100,
    abilityName: template.abilityName || '', abilityFn: template.abilityFn || null,
    abilityBcd: template.abilityBcd || 6000, abilityCd: template.abilityBcd || 6000,
    onDeath: template.onDeath || null,
    _buffs: [], _debuffs: [], _reborn: false,
  };
}

export function applyFollowerBuff(hero, collection, followerIdx) {
  if (followerIdx === null || followerIdx < 0 || followerIdx >= collection.length) return;
  var f = collection[followerIdx];
  for (var k in f.buff) {
    if (k === 'hp') { hero.maxHp += f.buff[k]; hero.hp += f.buff[k] }
    else if (k === 'baseDmg') hero.baseDmg += f.buff[k];
    else if (k === 'baseAS') hero.baseAS += f.buff[k];
    else if (k === 'def') hero.def += f.buff[k];
    else if (k === 'evasion') hero.evasion = Math.min(0.8, (hero.evasion || 0) + f.buff[k]);
    else if (k === 'moveSpeed') hero.moveSpeed += f.buff[k];
    else if (k === 'mana') { hero.maxMana = (hero.maxMana || 0) + f.buff[k]; hero.mana = (hero.mana || 0) + f.buff[k] }
  }
}

