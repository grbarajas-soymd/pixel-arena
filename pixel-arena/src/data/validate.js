#!/usr/bin/env node
// =============== CONTENT VALIDATION ===============
// Validates game content against established balance ranges.
// Usage:
//   node src/data/validate.js                    # Validate ALL content
//   node src/data/validate.js --type items       # Validate only items
//   node src/data/validate.js --type skills      # etc (skills|classes|followers|monsters)
//   node src/data/validate.js --verbose          # Show all checks, not just failures

// ---- ANSI Colors ----
var R = '\x1b[31m', G = '\x1b[32m', Y = '\x1b[33m', C = '\x1b[36m', DIM = '\x1b[2m', BOLD = '\x1b[1m', RST = '\x1b[0m'

// ---- Valid Enums ----
var VALID_SLOTS = ['weapon', 'helmet', 'chest', 'boots', 'accessory']
var VALID_RARITIES = ['starter', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
var VALID_SOURCES = ['Mage', 'Ranger', 'Rogue', 'Warrior']
var VALID_MONSTER_TYPES = ['humanoid', 'beast', 'blob', 'ghost', 'winged']
var FOLLOWER_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']

// ---- Balance Ranges ----
// Derived from existing content with ~20% margin for future additions.
// Per-rarity ranges only check stats the item actually has (not all items have all stats).

var ITEM_RANGES = {
  starter:    { baseDmg: [10, 75],  baseAS: [0.3, 0.65],  def: [2, 12],  hp: [80, 250] },
  common:     { baseDmg: [25, 95],  baseAS: [0.4, 0.8],   def: [6, 25],  hp: [150, 350] },
  uncommon:   { baseDmg: [5, 115],  baseAS: [0.15, 0.9],  def: [3, 22],  hp: [80, 500] },
  rare:       { baseDmg: [95, 160], baseAS: [0.5, 0.9],   def: [3, 35],  hp: [100, 600] },
  epic:       { baseDmg: [35, 215], baseAS: [0.55, 0.9],  def: [4, 30],  hp: [250, 900] },
  legendary:  { baseDmg: [50, 300], baseAS: [0.08, 1.0],  def: [8, 50],  hp: [350, 1200] },
  mythic:     { baseDmg: [70, 400], baseAS: [0.12, 1.15], def: [12, 65], hp: [250, 1600] },
}

// Global sanity ranges for less common stats (not per-rarity)
var ITEM_GLOBAL_RANGES = {
  moveSpeed: [-15, 100],
  evasion: [0.01, 0.20],
  mana: [50, 300],
  manaRegen: [1, 8],
  energy: [20, 150],
  energyRegen: [1, 20],
  spellDmgBonus: [0.03, 0.25],
}

var SKILL_RANGES = { bcd: [1500, 15000], cost: [0, 50] }

var CLASS_RANGES = {
  hp: [3000, 7000],
  baseDmg: [80, 280],
  baseAS: [0.5, 1.5],
  def: [0, 100],
  evasion: [0, 0.25],
  moveSpeed: [60, 160],
}

var FOLLOWER_RANGES = {
  common:    { combatHp: [200, 750],  combatDmg: [15, 35],  combatAS: [0.6, 1.7],  combatDef: [2, 28] },
  uncommon:  { combatHp: [400, 950],  combatDmg: [24, 55],  combatAS: [0.6, 1.5],  combatDef: [4, 32] },
  rare:      { combatHp: [550, 1150], combatDmg: [28, 65],  combatAS: [0.7, 1.55], combatDef: [10, 45] },
  epic:      { combatHp: [700, 1800], combatDmg: [30, 75],  combatAS: [0.5, 1.45], combatDef: [12, 58] },
  legendary: { combatHp: [1000, 1700],combatDmg: [65, 95],  combatAS: [0.8, 1.2],  combatDef: [30, 55] },
}

var MONSTER_RANGES = {
  1: { hp: [200, 400],  dmg: [20, 55],  def: [1, 12] },
  2: { hp: [400, 950],  dmg: [50, 95],  def: [4, 30] },
  3: { hp: [900, 1900], dmg: [80, 150], def: [12, 55] },
  4: { hp: [1800, 2800], dmg: [120, 180], def: [25, 50] },
}

// ---- Result Tracking ----
var errors = 0, warnings = 0, passes = 0
var verbose = false

function pass(msg) { passes++; if (verbose) console.log(G + '  PASS ' + RST + msg) }
function warn(msg) { warnings++; console.log(Y + '  WARN ' + RST + msg) }
function fail(msg) { errors++; console.log(R + '  FAIL ' + RST + msg) }
function header(msg) { console.log('\n' + BOLD + C + msg + RST) }

function checkRange(label, val, lo, hi) {
  if (val < lo || val > hi) { fail(label + ' = ' + val + ' (expected ' + lo + '-' + hi + ')'); return false }
  // Warn if within 10% of bounds (but not if value exactly equals a natural boundary like 0)
  var range = hi - lo
  if (range > 0 && val !== lo && val !== hi && (val - lo < range * 0.1 || hi - val < range * 0.1)) {
    warn(label + ' = ' + val + ' (near bounds ' + lo + '-' + hi + ')')
    return true
  }
  pass(label + ' = ' + val); return true
}

function checkEnum(label, val, allowed) {
  if (!allowed.includes(val)) { fail(label + ' = "' + val + '" (expected one of: ' + allowed.join(', ') + ')'); return false }
  pass(label + ' = "' + val + '"'); return true
}

function checkExists(label, val) {
  if (val === undefined || val === null) { fail(label + ' is missing'); return false }
  pass(label + ' exists'); return true
}

// ---- Validators ----

export function validateItems(ITEMS) {
  header('Validating Items (' + Object.keys(ITEMS).length + ' items)')
  for (var key in ITEMS) {
    var item = ITEMS[key]
    var prefix = key + ' [' + (item.rarity || '?') + ']'
    if (verbose) console.log(DIM + '  --- ' + prefix + ' ---' + RST)

    checkExists(prefix + '.name', item.name)
    checkExists(prefix + '.stats', item.stats)
    checkExists(prefix + '.desc', item.desc)
    checkEnum(prefix + '.slot', item.slot, VALID_SLOTS)
    checkEnum(prefix + '.rarity', item.rarity, VALID_RARITIES)

    if (item.slot === 'weapon') {
      checkExists(prefix + '.rangeType', item.rangeType)
    }

    if (!item.stats) continue
    var ranges = ITEM_RANGES[item.rarity]
    if (!ranges) continue

    // Check per-rarity stats (only if item has them)
    for (var stat in ranges) {
      if (item.stats[stat] !== undefined) {
        checkRange(prefix + '.stats.' + stat, item.stats[stat], ranges[stat][0], ranges[stat][1])
      }
    }
    // Check global stat ranges for less common stats
    for (var gstat in ITEM_GLOBAL_RANGES) {
      if (item.stats[gstat] !== undefined) {
        var gr = ITEM_GLOBAL_RANGES[gstat]
        checkRange(prefix + '.stats.' + gstat, item.stats[gstat], gr[0], gr[1])
      }
    }
  }
}

export function validateSkills(ALL_SKILLS, ALL_ULTS) {
  header('Validating Skills (' + ALL_SKILLS.length + ' skills, ' + ALL_ULTS.length + ' ultimates)')

  for (var i = 0; i < ALL_SKILLS.length; i++) {
    var sk = ALL_SKILLS[i]
    var prefix = (sk.id || 'skill_' + i)
    if (verbose) console.log(DIM + '  --- ' + prefix + ' ---' + RST)

    checkExists(prefix + '.id', sk.id)
    checkExists(prefix + '.name', sk.name)
    checkExists(prefix + '.desc', sk.desc)
    checkExists(prefix + '.icon', sk.icon)
    checkEnum(prefix + '.source', sk.source, VALID_SOURCES)

    if (typeof sk.ai !== 'function') fail(prefix + '.ai is not a function')
    else pass(prefix + '.ai is a function')

    checkRange(prefix + '.bcd', sk.bcd, SKILL_RANGES.bcd[0], SKILL_RANGES.bcd[1])
    checkRange(prefix + '.cost', sk.cost, SKILL_RANGES.cost[0], SKILL_RANGES.cost[1])
  }

  for (var j = 0; j < ALL_ULTS.length; j++) {
    var ult = ALL_ULTS[j]
    var uprefix = (ult.id || 'ult_' + j) + ' [ult]'
    if (verbose) console.log(DIM + '  --- ' + uprefix + ' ---' + RST)

    checkExists(uprefix + '.id', ult.id)
    checkExists(uprefix + '.name', ult.name)
    checkExists(uprefix + '.desc', ult.desc)
    checkExists(uprefix + '.icon', ult.icon)
    checkEnum(uprefix + '.source', ult.source, VALID_SOURCES)

    if (typeof ult.ai !== 'function') fail(uprefix + '.ai is not a function')
    else pass(uprefix + '.ai is a function')

    if (ult.threshold === undefined) fail(uprefix + '.threshold is missing')
    else if (ult.threshold < 0.1 || ult.threshold > 0.5) fail(uprefix + '.threshold = ' + ult.threshold + ' (expected 0.1-0.5)')
    else pass(uprefix + '.threshold = ' + ult.threshold)
  }
}

export function validateClasses(CLASSES) {
  var keys = Object.keys(CLASSES)
  header('Validating Classes (' + keys.length + ' classes)')

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
    var cls = CLASSES[key]
    var prefix = key
    if (verbose) console.log(DIM + '  --- ' + prefix + ' ---' + RST)

    checkExists(prefix + '.name', cls.name)
    checkExists(prefix + '.desc', cls.desc)
    checkExists(prefix + '.icon', cls.icon)
    checkExists(prefix + '.color', cls.color)

    for (var stat in CLASS_RANGES) {
      if (cls[stat] !== undefined) {
        checkRange(prefix + '.' + stat, cls[stat], CLASS_RANGES[stat][0], CLASS_RANGES[stat][1])
      } else if (stat === 'hp' || stat === 'baseDmg' || stat === 'baseAS' || stat === 'def') {
        fail(prefix + '.' + stat + ' is missing (required)')
      }
    }
  }
}

export function validateFollowers(FOLLOWER_TEMPLATES) {
  header('Validating Followers (' + FOLLOWER_TEMPLATES.length + ' followers)')

  for (var i = 0; i < FOLLOWER_TEMPLATES.length; i++) {
    var f = FOLLOWER_TEMPLATES[i]
    var prefix = (f.name || 'follower_' + i) + ' [' + (f.rarity || '?') + ']'
    if (verbose) console.log(DIM + '  --- ' + prefix + ' ---' + RST)

    checkExists(prefix + '.name', f.name)
    checkExists(prefix + '.icon', f.icon)
    checkEnum(prefix + '.rarity', f.rarity, FOLLOWER_RARITIES)
    checkExists(prefix + '.buff', f.buff)
    checkExists(prefix + '.buffDesc', f.buffDesc)
    checkExists(prefix + '.abilityName', f.abilityName)

    if (typeof f.abilityFn !== 'function') fail(prefix + '.abilityFn is not a function')
    else pass(prefix + '.abilityFn is a function')

    var ranges = FOLLOWER_RANGES[f.rarity]
    if (!ranges) continue

    for (var stat in ranges) {
      if (f[stat] !== undefined) {
        checkRange(prefix + '.' + stat, f[stat], ranges[stat][0], ranges[stat][1])
      } else {
        fail(prefix + '.' + stat + ' is missing')
      }
    }
  }
}

export function validateMonsters(DG_MONSTERS) {
  header('Validating Monsters (' + DG_MONSTERS.length + ' monsters)')

  for (var i = 0; i < DG_MONSTERS.length; i++) {
    var m = DG_MONSTERS[i]
    var prefix = (m.name || 'monster_' + i) + ' [tier ' + (m.tier || '?') + ']'
    if (verbose) console.log(DIM + '  --- ' + prefix + ' ---' + RST)

    checkExists(prefix + '.name', m.name)
    checkExists(prefix + '.icon', m.icon)
    checkEnum(prefix + '.monsterType', m.monsterType, VALID_MONSTER_TYPES)

    if (!m.specials || !Array.isArray(m.specials)) fail(prefix + '.specials missing or not array')
    else pass(prefix + '.specials has ' + m.specials.length + ' entries')

    if (m.tier < 1 || m.tier > 4) { fail(prefix + '.tier = ' + m.tier + ' (expected 1-4)'); continue }
    pass(prefix + '.tier = ' + m.tier)

    var ranges = MONSTER_RANGES[m.tier]
    if (!ranges) continue

    checkRange(prefix + '.hp', m.hp, ranges.hp[0], ranges.hp[1])
    checkRange(prefix + '.dmg', m.dmg, ranges.dmg[0], ranges.dmg[1])
    checkRange(prefix + '.def', m.def, ranges.def[0], ranges.def[1])
  }
}

// ---- CLI Entry Point ----
async function main() {
  // Shim browser globals so sfx.js module-level code doesn't crash in Node
  if (typeof globalThis.document === 'undefined') {
    globalThis.document = { addEventListener: function() {} }
  }
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = globalThis
  }

  var args = process.argv.slice(2)
  var typeFilter = null

  for (var i = 0; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) { typeFilter = args[++i] }
    if (args[i] === '--verbose' || args[i] === '-v') { verbose = true }
  }

  console.log(BOLD + '\n=== Content Validator ===' + RST)
  if (typeFilter) console.log('Filter: ' + typeFilter)
  if (verbose) console.log('Verbose mode: on')

  var types = typeFilter ? [typeFilter] : ['items', 'skills', 'classes', 'followers', 'monsters']

  for (var t = 0; t < types.length; t++) {
    var type = types[t]
    try {
      if (type === 'items') {
        var { ITEMS } = await import('./items.js')
        validateItems(ITEMS)
      } else if (type === 'skills') {
        var { ALL_SKILLS, ALL_ULTS } = await import('./skills.js')
        validateSkills(ALL_SKILLS, ALL_ULTS)
      } else if (type === 'classes') {
        var { CLASSES } = await import('./classes.js')
        validateClasses(CLASSES)
      } else if (type === 'followers') {
        var { FOLLOWER_TEMPLATES } = await import('./followers.js')
        validateFollowers(FOLLOWER_TEMPLATES)
      } else if (type === 'monsters') {
        // dungeon.js has heavy browser deps — extract DG_MONSTERS from source
        var { readFileSync } = await import('fs')
        var { fileURLToPath } = await import('url')
        var { dirname, join } = await import('path')
        var dir = dirname(fileURLToPath(import.meta.url))
        var src = readFileSync(join(dir, '../modes/dungeon.js'), 'utf8')
        var match = src.match(/var DG_MONSTERS\s*=\s*\[([\s\S]*?)\];/)
        if (!match) { console.log(Y + '  SKIP ' + RST + 'Could not extract DG_MONSTERS from dungeon.js'); continue }
        // Parse the array — entries are plain data objects (no functions)
        var monsters = new Function('return [' + match[1] + ']')()
        validateMonsters(monsters)
      } else {
        console.log(Y + '  SKIP ' + RST + 'Unknown type: ' + type)
      }
    } catch (e) {
      console.log(R + '  ERR  ' + RST + 'Failed to load ' + type + ': ' + e.message)
      if (verbose) console.log(e.stack)
    }
  }

  // Summary
  console.log('\n' + BOLD + '=== Summary ===' + RST)
  console.log(G + '  ' + passes + ' passed' + RST)
  if (warnings) console.log(Y + '  ' + warnings + ' warnings' + RST)
  if (errors) console.log(R + '  ' + errors + ' errors' + RST)
  else console.log(G + '  All checks passed!' + RST)
  console.log('')

  process.exit(errors > 0 ? 1 : 0)
}

// Run CLI when executed directly
import { fileURLToPath as _toPath } from 'url'
var _thisFile = _toPath(import.meta.url)
var _argFile = process.argv[1]
// Normalize paths for Windows compatibility
if (_argFile && (_argFile.replace(/\\/g, '/') === _thisFile.replace(/\\/g, '/')
    || _argFile.endsWith('validate.js'))) {
  main()
}
