// =============== SPELL AI & BUFF MANAGEMENT ===============
import { state } from '../gameState.js';
import { TK, MELEE, AX, AW } from '../constants.js';
import { CLASSES } from '../data/classes.js';
import { SFX } from '../sfx.js';
import { en, dst, isStunned, effEv, blN, addBl, addCh, getSdm, getRage, getTarget, calcDmg, addLog, checkDeath } from './engine.js';
import { mkFollower } from './hero.js';
import { spSparks, spFloat, spFire, spPoison, spSmoke, spShadow, spStun, spDrips, spLightning, spLStrike } from '../render/particles.js';
import { ALL_SKILLS, ALL_ULTS } from '../data/skills.js';

// =============== SPELL AI DISPATCHER ===============
export function spellAI(h, t) { if (h.type === 'wizard') wizAI(h, t); else if (h.type === 'ranger') rgrAI(h, t); else if (h.type === 'barbarian') barbAI(h, t); else if (h.type === 'custom') customAI(h, t); else asnAI(h, t) }

function wizAI(w, t) {
  if (isStunned(w)) return;
  const e = en(w), d = dst(w, e), hp = w.hp / w.maxHp, c = CLASSES.wizard;
  if (!w.spells.ultimate.used && hp < c.ultThreshold) { w.spells.ultimate.used = true; w.ultActive = true; w.ultEnd = t + c.ultDur; w.ultStrikes = c.ultStrikes; w.ultStrikeTimer = 0; w.castAnim = 1; addCh(w, 5); spSparks(w.x, w.y - 40, 12, '#44ddbb'); SFX.ult(); addLog(t, `\u26A1 ${w.name} THUNDERSTORM!`, 'ult'); return }
  if (w.spells.chainLightning.cd <= 0 && w.mana >= c.chainCost && d <= w.spellRange) {
    w.mana -= c.chainCost; w.spells.chainLightning.cd = c.chainBcd; w.castAnim = 1;
    if (Math.random() < effEv(e) * 0.6) { addCh(w, 1); addLog(t, `Chain Zap DODGED!`, 'miss'); return }
    let dm = c.chainDmg * getSdm(w) * (1 - Math.min(e.def / 300, .8));
    if (e.type === 'barbarian' && CLASSES.barbarian.spellDodge && Math.random() < CLASSES.barbarian.spellDodge) { dm *= 0.5; spFloat(e.x, e.y - 40, 'RESIST', '#ff8888') }
    const tg = getTarget(w);
    if (tg.type === 'follower' && tg.tgt.alive) { tg.tgt.hp -= dm; w.totDmg += dm; tg.tgt.hurtAnim = 1; spLightning(w.x, w.y - 40, tg.tgt.x, tg.tgt.y - 15); spFloat(tg.tgt.x, tg.tgt.y - 50, `\u26A1${Math.round(dm)}`, '#44ddbb'); addLog(t, `Chain > Pet ${Math.round(dm)}`, 'shock'); if (tg.tgt.hp <= 0) killFollowerInternal(tg.owner, t); const b = dm * c.chainBounce; e.hp -= b; w.totDmg += b; e.hurtAnim = 1; spLightning(tg.tgt.x, tg.tgt.y - 15, e.x, e.y - 30); spFloat(e.x, e.y - 60, `\u26A1${Math.round(b)}`, '#88ddbb') }
    else { e.hp -= dm; w.totDmg += dm; e.hurtAnim = 1; spLightning(w.x, w.y - 40, e.x, e.y - 30); spFloat(e.x, e.y - 60, `\u26A1${Math.round(dm)}`, '#44ddbb'); addLog(t, `Chain > ${e.name} ${Math.round(dm)}`, 'shock'); if (e.follower && e.follower.alive) { const b = dm * c.chainBounce; e.follower.hp -= b; e.follower.hurtAnim = 1; spLightning(e.x, e.y - 30, e.follower.x, e.follower.y - 15); if (e.follower.hp <= 0) killFollowerInternal(e, t) } }
    e.shocked = true; e.shockedEnd = t + 3000;
    e.slow = c.chainSlow; e.slowEnd = t + c.chainSlowDur;
    if (!e.stealthed && !(e.type === 'barbarian' && CLASSES.barbarian.stunResist && Math.random() < CLASSES.barbarian.stunResist)) { e.stunEnd = t + c.chainStun; spStun(e.x, e.y - 50); addLog(t, `${e.name} STUNNED ${c.chainStun}ms!`, 'stun') }
    addCh(w, 1);
  }
  if (w.spells.lightningBolt.cd <= 0 && w.mana >= c.boltCost && d <= w.spellRange) {
    w.mana -= c.boltCost; w.spells.lightningBolt.cd = c.boltBcd; w.castAnim = 1;
    if (Math.random() < effEv(e) * 0.6) { addLog(t, `Bolt DODGED!`, 'miss'); return }
    let dm = c.boltDmg * getSdm(w) * (1 - Math.min(e.def / 300, .8));
    if (e.type === 'barbarian' && CLASSES.barbarian.spellDodge && Math.random() < CLASSES.barbarian.spellDodge) { dm *= 0.5; spFloat(e.x, e.y - 40, 'RESIST', '#ff8888') }
    e.hp -= dm; w.totDmg += dm; e.hurtAnim = 1;
    spFloat(e.x, e.y - 50, `\u26A1${Math.round(dm)}`, '#88ffdd');
    spSparks(e.x, e.y - 30, 3, '#44ddbb');
    addLog(t, `Bolt > ${e.name} ${Math.round(dm)}`, 'shock');
    addCh(w, 1);
  }
  if (w.spells.staticShield.cd <= 0 && w.mana >= c.shieldCost && hp < .65 && !w.shieldActive) { w.mana -= c.shieldCost; w.spells.staticShield.cd = c.shieldBcd; w.shieldActive = true; w.shieldHp = c.shieldHp; w.shieldEnd = t + c.shieldDur; w.castAnim = 1; addCh(w, 1); SFX.shield(); addLog(t, `${w.name} Shield (${c.shieldHp})!`, 'spell') }
}

export function procWizUlt(w, t, dt) { if (!w.ultActive || w.ultStrikes <= 0) return; w.ultStrikeTimer += dt; if (w.ultStrikeTimer >= 450) { w.ultStrikeTimer = 0; w.ultStrikes--; const e = en(w), c = CLASSES.wizard; let dm = c.ultDmg * getSdm(w) * (1 - Math.min(e.def / 300, .8)); e.hp -= dm; w.totDmg += dm; e.hurtAnim = 1; const hl = dm * c.ultHeal; w.hp = Math.min(w.maxHp, w.hp + hl); w.totHeal += hl; e.shocked = true; e.shockedEnd = t + 3000; if (!e.stealthed) { e.stunEnd = t + 250 } spLStrike(e.x); spFloat(e.x, e.y - 65, `\u26A1${Math.round(dm)}`, '#44ddbb'); spFloat(w.x, w.y - 55, `+${Math.round(hl)}`, '#44aa66'); addLog(t, `Storm ${Math.round(dm)} heal ${Math.round(hl)}`, 'ult') } }

function rgrAI(r, t) {
  if (isStunned(r)) return;
  const e = en(r), eB = blN(e), hp = r.hp / r.maxHp;
  if (!r.spells.ultimate.used && hp < .2) { r.spells.ultimate.used = true; r.ultActive = true; r.ultEnd = t + 2000; r.castAnim = 1; spFire(r.x, r.y - 30, 15); SFX.ult(); SFX.fire(); addLog(t, `\u{1F525} ${r.name} RAIN OF FIRE!`, 'ult'); return }
  if (r.spells.huntersMark.cd <= 0 && eB >= 1) { const s = .01 * blN(e); e.slow = s; e.slowEnd = t + 2000; r.markNext = true; addBl(e, t); r.spells.huntersMark.cd = 8000; r.castAnim = 1; addLog(t, `${r.name} Mark! Slow ${Math.round(s * 100)}%`, 'spell') }
  if (r.spells.bloodlust.cd <= 0 && eB >= 2) { r.blActive = true; r.blEnd = t + 2500; r.blDmg = 0; r.spells.bloodlust.cd = 12000; r.castAnim = 1; spFire(r.x, r.y - 30, 6); addLog(t, `${r.name} Bloodlust!`, 'spell') }
  if (r.spells.sacrifice.cd <= 0 && !r.followerAlive && r.blActive) { r.follower = mkFollower(r); r.followerAlive = true; r.spells.sacrifice.cd = 15000; r.castAnim = 1; SFX.summon(); spFire(r.follower.x, r.follower.y - 15, 6); addLog(t, `${r.name} summons pet!`, 'summon') }
}

function asnAI(a, t) {
  if (isStunned(a)) return;
  const e = en(a), d = dst(a, e), hp = a.hp / a.maxHp;
  if (!a.spells.ultimate.used && hp < (CLASSES.assassin.ultThreshold || 0.25)) { a.spells.ultimate.used = true; a.castAnim = 1; a.combo = a.maxCombo; e.deathMarkTarget = true; e.deathMarkEnd = t + 3500; e.deathMarkDmg = 0; spSparks(e.x, e.y - 30, 10, '#ff8800'); spFloat(e.x, e.y - 70, 'DEATH MARK', '#ff8800'); SFX.ult(); addLog(t, `\u2620 ${a.name} DEATH MARK!`, 'ult'); return }
  if (a.spells.shadowStep.cd <= 0 && a.energy >= 25 && d > 100 && !a.stealthed) { a.energy -= 25; a.spells.shadowStep.cd = 3500; a.castAnim = 1; const behindX = e.x + (e.x > a.x ? 50 : -50); spShadow(a.x, a.y - 20); a.x = Math.max(AX + 25, Math.min(AX + AW - 25, behindX)); a.y = e.y || a.y; a.stealthed = true; a.stealthEnd = t + 2000; a.combo = Math.min(a.maxCombo, a.combo + 2); spShadow(a.x, a.y - 20); addLog(t, `${a.name} Shadow Step!`, 'stealth') }
  if (a.spells.envenom.cd <= 0 && a.energy >= 30 && d <= a.meleeRange + 60) { a.energy -= 30; a.spells.envenom.cd = 8000; a.castAnim = 1; a.envenomed = true; a.envenomedEnd = t + 5000; a.combo = Math.min(a.maxCombo, a.combo + 1); SFX.poison(); spPoison(a.x, a.y - 30, 6); addLog(t, `${a.name} Envenom!`, 'poison') }
  if (a.spells.smokeBomb.cd <= 0 && a.energy >= 35 && hp < .55 && !a.smokeBombActive) { a.energy -= 35; a.spells.smokeBomb.cd = 12000; a.castAnim = 1; a.smokeBombActive = true; a.smokeBombEnd = t + 4000; a.smokeBombX = a.x; spSmoke(a.x, a.y - 20, 15); addLog(t, `${a.name} Smoke Bomb!`, 'stealth') }
}

function barbAI(b, t) {
  if (isStunned(b)) return; const e = en(b), d = dst(b, e), hp = b.hp / b.maxHp, c = CLASSES.barbarian;
  if (!b.spells.ultimate.used && hp < c.ultThreshold) { b.spells.ultimate.used = true; b.ultActive = true; b.ultEnd = t + c.ultDur; b.castAnim = 1; spSparks(b.x, b.y - 40, 12, '#cc4444'); spFloat(b.x, b.y - 70, 'BERSERKER', '#ff4444'); SFX.ult(); SFX.warCry(); addLog(t, `\u{1F480} ${b.name} BERSERKER RAGE!`, 'ult'); return }
  if (b.spells.charge.cd <= 0 && d >= c.chargeMinRange && d <= c.chargeRange) { b.spells.charge.cd = c.chargeBcd; b.castAnim = 1; const dir = e.x > b.x ? 1 : -1; SFX.charge(); spSparks(b.x, b.y - 20, 6, '#cc4444'); b.x = Math.max(AX + 25, Math.min(AX + AW - 25, e.x - dir * 45)); b.y = e.y || b.y; let dm = c.chargeDmg * (1 - Math.min(e.def / 300, .8)) * getRage(b).d; if (b.ultActive) dm *= (1 + (c.ultDmg || 0)); e.hp -= dm; b.totDmg += dm; e.hurtAnim = 1; spFloat(e.x, e.y - 60, `\u{1F4A5}${Math.round(dm)}`, '#cc4444'); spSparks(e.x, e.y - 30, 8, '#ff6666'); addLog(t, `${b.name} CHARGE ${Math.round(dm)}!`, 'dmg'); let ls = dm * (c.lifesteal + (b.ultActive ? (c.ultLifesteal || 0) : 0)); b.hp = Math.min(b.maxHp, b.hp + ls); if (ls > 1) { b.totHeal += ls; spFloat(b.x, b.y - 50, `+${Math.round(ls)}`, '#44aa66') } }
  if (b.spells.warCry.cd <= 0 && d <= c.warCryRange) { b.spells.warCry.cd = c.warCryBcd; b.castAnim = 1; SFX.warCry(); e.slow = c.warCrySlow; e.slowEnd = t + c.warCrySlowDur; spSparks(b.x, b.y - 30, 6, '#ffaa44'); addLog(t, `${b.name} WAR CRY! Slow ${Math.round(c.warCrySlow * 100)}%`, 'spell') }
}

// =============== CUSTOM AI ===============
function customAI(h, t) {
  if (isStunned(h)) return; h.resource = Math.min(h.maxResource, (h.resource || 0) + (h.resourceRegen || 2) * (TK / 1000));
  if (h.customUltId !== null && ALL_ULTS[h.customUltId] && h.spells.ultimate && !h.spells.ultimate.used) { try { if (ALL_ULTS[h.customUltId].ai(h, t)) return } catch (e) { } }
  for (var i = 0; i < (h.customSkillIds || []).length; i++) { var sk = h.customSkillIds[i], spell = h.spells[sk.key]; if (!spell || spell.cd > 0) continue; var origSkill0 = h.spells.skill0; h.spells.skill0 = spell; try { if (ALL_SKILLS[sk.idx].ai(h, t)) { h.spells.skill0 = origSkill0; return } } catch (e) { } h.spells.skill0 = origSkill0 }
}

// =============== BUFF EXPIRY ===============
export function procExp(h, t) {
  if (h.type === 'ranger') { if (h.blActive && t >= h.blEnd) { h.blActive = false; const hl = h.blDmg * .35; h.hp = Math.min(h.maxHp, h.hp + hl); h.totHeal += hl; SFX.heal(); spFloat(h.x, h.y - 60, `+${Math.round(hl)}`, '#44aa66'); addLog(t, `Bloodlust heal ${Math.round(hl)}`, 'heal') } if (h.ultActive && t >= h.ultEnd) { h.ultActive = false } }
  if (h.type === 'wizard') { if (h.shieldActive && t >= h.shieldEnd) { h.shieldActive = false } if (h.ultActive && t >= h.ultEnd) { h.ultActive = false } }
  if (h.type === 'assassin') { if (h.stealthed && t >= h.stealthEnd) h.stealthed = false; if (h.envenomed && t >= h.envenomedEnd) h.envenomed = false; if (h.smokeBombActive && t >= h.smokeBombEnd) h.smokeBombActive = false; if (h.combo > 0 && h.atkCd > 200) h.combo = Math.max(0, h.combo - 0.5 * (TK / 1000)) }
  if (h.type === 'barbarian') { if (h.ultActive && t >= h.ultEnd) h.ultActive = false }
  if (h.type === 'custom') { if (h.blActive && t >= h.blEnd) { h.blActive = false; var hl = h.blDmg * .35; h.hp = Math.min(h.maxHp, h.hp + hl); h.totHeal += hl; spFloat(h.x, h.y - 60, '+' + Math.round(hl), '#44aa66') } if (h.shieldActive && t >= h.shieldEnd) h.shieldActive = false; if (h.ultActive && t >= h.ultEnd) h.ultActive = false; if (h.stealthed && t >= h.stealthEnd) h.stealthed = false; if (h.envenomed && t >= h.envenomedEnd) h.envenomed = false; if (h.smokeBombActive && t >= h.smokeBombEnd) h.smokeBombActive = false }
  if (h.deathMarkTarget && t >= h.deathMarkEnd) { h.deathMarkTarget = false; const burst = h.deathMarkDmg * (CLASSES.assassin.deathMarkDmg || 0.85); h.hp -= burst; h.hurtAnim = 1; spFloat(h.x, h.y - 70, `\u2620${Math.round(burst)}`, '#ff4400'); spSparks(h.x, h.y - 30, 10, '#ff8800'); addLog(t, `Death Mark pops ${Math.round(burst)}!`, 'ult') }
  if (h.slow > 0 && t >= h.slowEnd) h.slow = 0; if (h.shocked && t >= h.shockedEnd) h.shocked = false;
}

export function procRes(h, dt) { if (h.type === 'wizard') { h.mana = Math.min(h.maxMana, h.mana + h.manaRegen * (dt / 1000)); if (h.charge > 0) { h.chargeDecayTimer += dt; if (h.chargeDecayTimer >= 4000) { h.chargeDecayTimer = 0; h.charge = Math.max(0, h.charge - 1) } } } if (h.type === 'assassin') h.energy = Math.min(h.maxEnergy, h.energy + h.energyRegen * (dt / 1000)) }
export function tickCD(h, dt) { for (const k in h.spells) if (h.spells[k].cd > 0) h.spells[k].cd = Math.max(0, h.spells[k].cd - dt) }

// Internal helper to avoid circular import with engine's killFollower
function killFollowerInternal(owner, t) { if (!owner.follower) return; owner.follower.alive = false; owner.followerAlive = false; spSparks(owner.follower.x, owner.follower.y - 15, 8, '#cc88ff'); addLog(t, `${owner.name}'s pet slain!`, 'summon'); if (owner.blActive) { owner.blEnd += 500 } }
