// =============== HERO FACTORY ===============
import { state } from '../gameState.js';
import { AX, AW, GY, MELEE } from '../constants.js';
import { CLASSES } from '../data/classes.js';
import { ITEMS } from '../data/items.js';
import { ALL_SKILLS, ALL_ULTS } from '../data/skills.js';
import { RARITY_COLORS } from '../data/followers.js';

export function getCustomTotalStats() {
  var s = Object.assign({}, state.customChar.baseStats);
  for (var sk in state.customChar.equipment) { var ik = state.customChar.equipment[sk]; if (ik && ITEMS[ik]) for (var k in ITEMS[ik].stats) s[k] = (s[k] || 0) + ITEMS[ik].stats[k] }
  s.hp = Math.max(100, s.hp); s.baseDmg = Math.max(10, s.baseDmg); s.baseAS = Math.max(0.1, s.baseAS); s.def = Math.max(0, s.def); s.evasion = Math.max(0, Math.min(.8, s.evasion)); s.moveSpeed = Math.max(30, s.moveSpeed); return s;
}

export function getWeaponRangeType() {
  var wk = state.customChar.equipment.weapon;
  if (wk && ITEMS[wk] && ITEMS[wk].rangeType) return ITEMS[wk].rangeType;
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
    stats: { hp: s.hp, baseDmg: s.baseDmg, baseAS: s.baseAS, def: s.def, evasion: s.evasion, moveSpeed: s.moveSpeed, mana: s.mana || 0, manaRegen: s.manaRegen || 0, energy: s.energy || 0, energyRegen: s.energyRegen || 0, spellDmgBonus: s.spellDmgBonus || 0 }
  };
}

export function mkHero(classKey, side) {
  // Check for ladder-generated opponent
  if (side === 'right' && state._ladderGenConfig) {
    return mkLadderHero(state._ladderGenConfig, side);
  }
  if (classKey === 'custom') return mkCustomHero(side);
  const c = CLASSES[classKey]; const isLeft = side === 'left';
  const base = {
    type: classKey, name: c.nameShort, color: c.color, colorDark: c.colorDark, colorLight: c.colorLight, side,
    x: isLeft ? AX + 140 : AX + AW - 140, y: GY, facing: isLeft ? 1 : -1,
    maxHp: c.hp, hp: c.hp, baseDmg: c.baseDmg, baseAS: c.baseAS, def: c.def, evasion: c.evasion || 0,
    moveSpeed: c.moveSpeed, moveSpeedBonus: c.moveSpeedBonus || 0,
    attackRange: c.attackRange || c.throwRange || 200, preferredRange: c.preferredRange || 200,
    atkCnt: 0, atkCd: 0, bleedStacks: [],
    shocked: false, shockedEnd: 0, slow: 0, slowEnd: 0, stunEnd: 0,
    state: 'idle', bobPhase: isLeft ? 0 : Math.PI, attackAnim: 0, hurtAnim: 0, castAnim: 0,
    totDmg: 0, totHeal: 0,
    blActive: false, blEnd: 0, blDmg: 0, markNext: false,
    followerAlive: false, follower: null, followerMaxHp: c.followerMaxHp || 450, arenaFollowers: [],
    ultActive: false, ultEnd: 0,
    shieldActive: false, shieldHp: 0, shieldEnd: 0,
    mana: c.mana || 0, maxMana: c.mana || 0, manaRegen: c.manaRegen || 0,
    charge: 0, maxCharge: 10, chargeDecayTimer: 0,
    castSpeedBonus: c.castSpeedBonus || 0, spellDmgBonus: c.spellDmgBonus || 0,
    spellRange: c.spellRange || c.throwRange || 200,
    ultStrikes: 0, ultStrikeTimer: 0,
    energy: c.energy || 0, maxEnergy: c.energy || 0, energyRegen: c.energyRegen || 0,
    meleeRange: c.meleeRange || MELEE, throwRange: c.throwRange || 200,
    stealthed: false, stealthEnd: 0, combo: 0, maxCombo: 5,
    envenomed: false, envenomedEnd: 0,
    deathMarkTarget: false, deathMarkEnd: 0, deathMarkDmg: 0,
    smokeBombActive: false, smokeBombEnd: 0, smokeBombX: 0, smokeBombRadius: 120,
    spells: {}
  };
  if (classKey === 'wizard') {
    base.spells = { chainLightning: { cd: 0, bcd: c.chainBcd, cost: c.chainCost, n: "Chain Zap" }, lightningBolt: { cd: 0, bcd: c.boltBcd, cost: c.boltCost, n: "Bolt" }, staticShield: { cd: 0, bcd: c.shieldBcd, cost: c.shieldCost, n: "Shield" }, ultimate: { cd: 0, bcd: 1 / 0, used: false, n: "Storm" } };
  } else if (classKey === 'ranger') {
    base.spells = { huntersMark: { cd: 0, bcd: 8000, n: "Mark" }, bloodlust: { cd: 0, bcd: 12000, n: "Bloodlust" }, sacrifice: { cd: 0, bcd: 15000, n: "Summon" }, ultimate: { cd: 0, bcd: 1 / 0, used: false, n: "Rain of Fire" } };
  } else if (classKey === 'assassin') {
    base.spells = { shadowStep: { cd: 0, bcd: 3500, cost: 25, n: "Step" }, envenom: { cd: 0, bcd: 8000, cost: 30, n: "Envenom" }, smokeBomb: { cd: 0, bcd: 12000, cost: 35, n: "Smoke" }, ultimate: { cd: 0, bcd: 1 / 0, used: false, n: "Death Mark" } };
    base.attackRange = base.throwRange;
  } else if (classKey === 'barbarian') {
    base.spells = { charge: { cd: 0, bcd: c.chargeBcd || 5500, n: "Charge" }, warCry: { cd: 0, bcd: c.warCryBcd || 10000, n: "War Cry" }, ultimate: { cd: 0, bcd: 1 / 0, used: false, n: "Berserker" } };
  }
  return base;
}

export function mkFollower(owner) { return { alive: true, hp: owner.followerMaxHp, maxHp: owner.followerMaxHp, x: owner.x + owner.facing * 40, y: owner.y, moveSpeed: 140, attackRange: MELEE, goading: true, goadRange: 120, bobPhase: Math.random() * 6.28, hurtAnim: 0 } }

export function mkCustomHero(side) {
  var isLeft = side === 'left', s = getCustomTotalStats(), isMelee = getWeaponRangeType() === 'melee';
  var h = { type: 'custom', customSprite: state.customChar.sprite, name: state.customChar.name, color: '#ff88ff', colorDark: '#6a1a6a', colorLight: '#ffaaff', side: side, x: isLeft ? AX + 140 : AX + AW - 140, y: GY, facing: isLeft ? 1 : -1, maxHp: s.hp, hp: s.hp, baseDmg: s.baseDmg, baseAS: s.baseAS, def: s.def, evasion: s.evasion, moveSpeed: s.moveSpeed, moveSpeedBonus: 0, attackRange: isMelee ? 70 : 350, preferredRange: isMelee ? 50 : 300, atkCnt: 0, atkCd: 0, bleedStacks: [], shocked: false, shockedEnd: 0, slow: 0, slowEnd: 0, stunEnd: 0, state: 'idle', bobPhase: isLeft ? 0 : Math.PI, attackAnim: 0, hurtAnim: 0, castAnim: 0, totDmg: 0, totHeal: 0, blActive: false, blEnd: 0, blDmg: 0, markNext: false, followerAlive: false, follower: null, followerMaxHp: 450, arenaFollowers: [], ultActive: false, ultEnd: 0, shieldActive: false, shieldHp: 0, shieldEnd: 0, mana: s.mana || 0, maxMana: s.mana || 0, manaRegen: s.manaRegen || 0, charge: 0, maxCharge: 10, chargeDecayTimer: 0, castSpeedBonus: 0, spellDmgBonus: s.spellDmgBonus || 0, spellRange: isMelee ? 200 : 400, ultStrikes: 0, ultStrikeTimer: 0, energy: s.energy || 0, maxEnergy: s.energy || 0, energyRegen: s.energyRegen || 0, meleeRange: MELEE, throwRange: 200, stealthed: false, stealthEnd: 0, combo: 0, maxCombo: 5, envenomed: false, envenomedEnd: 0, deathMarkTarget: false, deathMarkEnd: 0, deathMarkDmg: 0, smokeBombActive: false, smokeBombEnd: 0, smokeBombX: 0, smokeBombRadius: 120, resource: Math.max(s.mana || 0, s.energy || 0, 100), maxResource: Math.max(s.mana || 0, s.energy || 0, 100), resourceRegen: Math.max(s.manaRegen || 0, s.energyRegen || 0, 2), spells: {}, customSkillIds: [], customUltId: null };
  for (var i = 0; i < 2; i++) { if (state.customChar.skills[i] !== null && ALL_SKILLS[state.customChar.skills[i]]) { h.spells['skill' + i] = { cd: 0, bcd: ALL_SKILLS[state.customChar.skills[i]].bcd || 3000, n: ALL_SKILLS[state.customChar.skills[i]].name }; h.customSkillIds.push({ idx: state.customChar.skills[i], key: 'skill' + i }) } }
  if (state.customChar.ultimate !== null && ALL_ULTS[state.customChar.ultimate]) { h.spells.ultimate = { cd: 0, bcd: Infinity, used: false, n: ALL_ULTS[state.customChar.ultimate].name }; h.customUltId = state.customChar.ultimate }
  return h;
}

export function mkLadderHero(cfg, side) {
  var isLeft = side === 'left';
  var isMelee = cfg.rangeType === 'melee';
  var h = { type: 'custom', customSprite: cfg.sprite, name: cfg.name, color: '#ff88ff', colorDark: '#6a1a6a', colorLight: '#ffaaff', side: side,
    x: isLeft ? AX + 140 : AX + AW - 140, y: GY, facing: isLeft ? 1 : -1,
    maxHp: cfg.hp, hp: cfg.hp, baseDmg: cfg.baseDmg, baseAS: cfg.baseAS, def: cfg.def, evasion: cfg.evasion,
    moveSpeed: cfg.moveSpeed, moveSpeedBonus: 0,
    attackRange: isMelee ? 70 : 350, preferredRange: isMelee ? 50 : 300,
    atkCnt: 0, atkCd: 0, bleedStacks: [], shocked: false, shockedEnd: 0, slow: 0, slowEnd: 0, stunEnd: 0,
    state: 'idle', bobPhase: isLeft ? 0 : Math.PI, attackAnim: 0, hurtAnim: 0, castAnim: 0,
    totDmg: 0, totHeal: 0, blActive: false, blEnd: 0, blDmg: 0, markNext: false,
    followerAlive: false, follower: null, followerMaxHp: 450, arenaFollowers: [],
    ultActive: false, ultEnd: 0, shieldActive: false, shieldHp: 0, shieldEnd: 0,
    mana: 300, maxMana: 300, manaRegen: 4, charge: 0, maxCharge: 10, chargeDecayTimer: 0,
    castSpeedBonus: 0, spellDmgBonus: 0, spellRange: isMelee ? 200 : 400,
    ultStrikes: 0, ultStrikeTimer: 0,
    energy: 100, maxEnergy: 100, energyRegen: 12,
    meleeRange: MELEE, throwRange: 200,
    stealthed: false, stealthEnd: 0, combo: 0, maxCombo: 5,
    envenomed: false, envenomedEnd: 0, deathMarkTarget: false, deathMarkEnd: 0, deathMarkDmg: 0,
    smokeBombActive: false, smokeBombEnd: 0, smokeBombX: 0, smokeBombRadius: 120,
    resource: 300, maxResource: 300, resourceRegen: 4,
    spells: {}, customSkillIds: [], customUltId: null,
  };
  for (var i = 0; i < cfg.skills.length && i < 2; i++) {
    if (cfg.skills[i] !== null && ALL_SKILLS[cfg.skills[i]]) {
      h.spells['skill' + i] = { cd: 0, bcd: ALL_SKILLS[cfg.skills[i]].bcd || 3000, n: ALL_SKILLS[cfg.skills[i]].name };
      h.customSkillIds.push({ idx: cfg.skills[i], key: 'skill' + i });
    }
  }
  if (cfg.ultimate !== null && ALL_ULTS[cfg.ultimate]) {
    h.customUltId = cfg.ultimate; h.spells.ultimate = { cd: 0, used: false };
  }
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
  var isLeft = side === 'left';
  var sprite = getMonsterSprite(m.name);
  return {
    type: 'custom', customSprite: sprite,
    name: m.name, monsterIcon: m.icon,
    color: '#ff4444', colorDark: '#6a1a1a', colorLight: '#ff8888', side: side,
    x: isLeft ? AX + 140 : AX + AW - 140, y: GY, facing: isLeft ? 1 : -1,
    maxHp: m.hp, hp: m.hp,
    baseDmg: m.dmg, baseAS: 0.8 + (m.tier - 1) * 0.15,
    def: m.def, evasion: m.evasion || 0,
    moveSpeed: 70 + m.tier * 10, moveSpeedBonus: 0,
    attackRange: 70, preferredRange: 50,
    atkCnt: 0, atkCd: 0, bleedStacks: [],
    shocked: false, shockedEnd: 0, slow: 0, slowEnd: 0, stunEnd: 0,
    state: 'idle', bobPhase: isLeft ? 0 : Math.PI, attackAnim: 0, hurtAnim: 0, castAnim: 0,
    totDmg: 0, totHeal: 0,
    blActive: false, blEnd: 0, blDmg: 0, markNext: false,
    followerAlive: false, follower: null, followerMaxHp: 0, arenaFollowers: [],
    ultActive: false, ultEnd: 0,
    shieldActive: false, shieldHp: 0, shieldEnd: 0,
    mana: 0, maxMana: 0, manaRegen: 0,
    charge: 0, maxCharge: 10, chargeDecayTimer: 0,
    castSpeedBonus: 0, spellDmgBonus: 0, spellRange: 200,
    ultStrikes: 0, ultStrikeTimer: 0,
    energy: 0, maxEnergy: 0, energyRegen: 0,
    meleeRange: MELEE, throwRange: 200,
    stealthed: false, stealthEnd: 0, combo: 0, maxCombo: 5,
    envenomed: false, envenomedEnd: 0,
    deathMarkTarget: false, deathMarkEnd: 0, deathMarkDmg: 0,
    smokeBombActive: false, smokeBombEnd: 0, smokeBombX: 0, smokeBombRadius: 120,
    resource: 0, maxResource: 0, resourceRegen: 0,
    spells: {}, customSkillIds: [], customUltId: null,
  };
}

export function mkDungeonHero(run, side) {
  var isLeft = side === 'left';
  var isMelee = getWeaponRangeType() === 'melee';
  var s = getCustomTotalStats();
  var h = {
    type: 'custom', customSprite: state.customChar.sprite,
    name: run.heroName, color: '#ff88ff', colorDark: '#6a1a6a', colorLight: '#ffaaff', side: side,
    x: isLeft ? AX + 140 : AX + AW - 140, y: GY, facing: isLeft ? 1 : -1,
    maxHp: run.maxHp, hp: run.hp,
    baseDmg: run.baseDmg + run.bonusDmg,
    baseAS: run.baseAS + run.bonusAS,
    def: run.def + run.bonusDef,
    evasion: run.evasion,
    moveSpeed: s.moveSpeed + (run.moveSpeed || 0), moveSpeedBonus: 0,
    attackRange: isMelee ? 70 : 350, preferredRange: isMelee ? 50 : 300,
    atkCnt: 0, atkCd: 0, bleedStacks: [],
    shocked: false, shockedEnd: 0, slow: 0, slowEnd: 0, stunEnd: 0,
    state: 'idle', bobPhase: isLeft ? 0 : Math.PI, attackAnim: 0, hurtAnim: 0, castAnim: 0,
    totDmg: 0, totHeal: 0,
    blActive: false, blEnd: 0, blDmg: 0, markNext: false,
    followerAlive: false, follower: null, followerMaxHp: 450, arenaFollowers: [],
    ultActive: false, ultEnd: 0,
    shieldActive: false, shieldHp: 0, shieldEnd: 0,
    mana: run.mana, maxMana: run.maxMana, manaRegen: run.manaRegen,
    charge: 0, maxCharge: 10, chargeDecayTimer: 0,
    castSpeedBonus: 0, spellDmgBonus: s.spellDmgBonus || 0,
    spellRange: isMelee ? 200 : 400,
    ultStrikes: 0, ultStrikeTimer: 0,
    energy: s.energy || 0, maxEnergy: s.energy || 0, energyRegen: s.energyRegen || 0,
    meleeRange: MELEE, throwRange: 200,
    stealthed: false, stealthEnd: 0, combo: 0, maxCombo: 5,
    envenomed: false, envenomedEnd: 0,
    deathMarkTarget: false, deathMarkEnd: 0, deathMarkDmg: 0,
    smokeBombActive: false, smokeBombEnd: 0, smokeBombX: 0, smokeBombRadius: 120,
    resource: Math.max(run.mana || 0, s.energy || 0, 100),
    maxResource: Math.max(run.maxMana || 0, s.energy || 0, 100),
    resourceRegen: Math.max(run.manaRegen || 0, s.energyRegen || 0, 2),
    spells: {}, customSkillIds: [], customUltId: null,
    _stashCrit: run._crit || 0,
    _stashLifesteal: run._lifesteal || 0,
  };
  // Apply skills from customChar
  for (var i = 0; i < 2; i++) {
    if (state.customChar.skills[i] !== null && ALL_SKILLS[state.customChar.skills[i]]) {
      h.spells['skill' + i] = { cd: 0, bcd: ALL_SKILLS[state.customChar.skills[i]].bcd || 3000, n: ALL_SKILLS[state.customChar.skills[i]].name };
      h.customSkillIds.push({ idx: state.customChar.skills[i], key: 'skill' + i });
    }
  }
  if (state.customChar.ultimate !== null && ALL_ULTS[state.customChar.ultimate]) {
    h.spells.ultimate = { cd: 0, bcd: Infinity, used: false, n: ALL_ULTS[state.customChar.ultimate].name };
    h.customUltId = state.customChar.ultimate;
  }
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
    color: RARITY_COLORS[template.rarity] || '#aaa',
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

