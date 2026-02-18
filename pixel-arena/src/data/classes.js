// =============== CLASS DEFINITIONS ===============
// Balance changes applied (Priority 3):
// - Wizard: hp 4000→4200, shieldHp 380→420
// - Barbarian: hp 5800→5500, stunImmune→stunResist 0.5, rageMaxDmg 0.50→0.45, slowResist 0.50→0.40
// - Assassin: ultThreshold 0.20→0.25, deathMarkDmg 0.85→0.90
// Balance pass 2 (simulation-driven):
// - Wizard: hp 4200→3900, baseDmg 130→115, chainDmg 260→220
// - Ranger: baseAS 0.95→1.05, evasion 0.05→0.10, hp 4800→5000

export const CLASSES = {
  wizard: {
    icon: '🧙', name: 'Iron Mage', nameShort: 'Voltaris',
    desc: '3900 HP · 650 Mana · Staff 115dmg\nChain Lightning · Lightning Bolt\nStatic Shield · Thunderstorm',
    color: '#44ddbb', colorDark: '#1a6a5a', colorLight: '#88ffdd',
    hp: 3900, mana: 650, manaRegen: 5.5, baseDmg: 115, baseAS: 0.75, def: 45, evasion: 0,
    moveSpeed: 88, moveSpeedBonus: 0.08, castSpeedBonus: 0.12, spellDmgBonus: 0.08,
    attackRange: 320, spellRange: 430, preferredRange: 380,
    chainDmg: 220, chainBcd: 5000, chainCost: 35, chainBounce: 0.5,
    chainStun: 450, chainSlow: 0.12, chainSlowDur: 1500,
    boltDmg: 140, boltBcd: 2200, boltCost: 20,
    shieldHp: 420, shieldBcd: 10000, shieldCost: 45, shieldDur: 5000, shieldReflect: 45,
    ultStrikes: 5, ultDmg: 200, ultDur: 2500, ultHeal: 0.42, ultThreshold: 0.25,
  },
  ranger: {
    icon: '🔥', name: 'Flame Ranger', nameShort: 'Pyralis',
    desc: '5000 HP · Longbow 180dmg\nHunter\'s Mark · Bloodlust\nSacrifice · Rain of Fire',
    color: '#ffaa44', colorDark: '#8a4400', colorLight: '#ffcc88',
    hp: 5000, baseDmg: 180, baseAS: 1.05, def: 58, evasion: 0.10,
    moveSpeed: 100, moveSpeedBonus: 0.15,
    attackRange: 420, spellRange: 420, preferredRange: 340,
    followerMaxHp: 450,
  },
  assassin: {
    icon: '❄', name: 'Frost Blade', nameShort: 'Glacier',
    desc: '4500 HP · 100 Energy · Daggers 140dmg\nShadow Step · Envenom\nSmoke Bomb · Death Mark',
    color: '#66ccff', colorDark: '#1a5588', colorLight: '#aaddff',
    hp: 4500, energy: 100, energyRegen: 14, baseDmg: 140, baseAS: 1.1, def: 42, evasion: 0.18,
    moveSpeed: 135, moveSpeedBonus: 0.10,
    meleeRange: 55, throwRange: 200, preferredRange: 48,
    deathMarkDmg: 0.90,
    ultThreshold: 0.25,
  },
  barbarian: {
    icon: '💀', name: 'Blood Warlord', nameShort: 'Gorath',
    desc: '5500 HP · Axe 230dmg · Stun Resist\nCharge · War Cry\nRage Passive · Berserker Ult',
    color: '#cc4444', colorDark: '#6a1a1a', colorLight: '#ff8888',
    hp: 5500, baseDmg: 210, baseAS: 0.85, def: 65, evasion: 0,
    moveSpeed: 130, moveSpeedBonus: 0.05,
    attackRange: 70, preferredRange: 50,
    rageMaxDmg: 0.45, rageMaxAS: 0.35,
    chargeDmg: 200, chargeBcd: 5500, chargeRange: 350, chargeMinRange: 100,
    warCryBcd: 10000, warCrySlow: 0.25, warCrySlowDur: 2500, warCryRange: 150,
    lifesteal: 0.03, stunResist: 0.5, slowResist: 0.40,
    spellDodge: 0.15, dmgVariance: 0.15,
    ultDur: 4000, ultAS: 0.40, ultDmg: 0.25, ultLifesteal: 0.03, ultThreshold: 0.30,
  }
};
