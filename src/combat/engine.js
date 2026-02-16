// =============== COMBAT ENGINE ===============
import { state } from '../gameState.js';
import { AX, AW, AY, AH, GY, GY_MIN, GY_MAX, TK, MELEE, RANGED_PEN } from '../constants.js';
import { CLASSES } from '../data/classes.js';
import { SFX } from '../sfx.js';
import { spSparks, spDrips, spFloat, spLightning, spLStrike, spSmoke, spShadow, spPoison, spFire, spStun, updParticles } from '../render/particles.js';
import { moveAI, clampH, moveFollower } from './movement.js';
import { spellAI, procExp, procRes, tickCD, procWizUlt } from './buffs.js';
import { ALL_ULTS } from '../data/skills.js';

// =============== UTILS ===============
export const en = h => h === state.h1 ? state.h2 : state.h1;
export const dst = (a, b) => Math.sqrt((a.x - b.x) ** 2 + ((a.y || GY) - (b.y || GY)) ** 2);
const AF_DMG_REDUCTION = 0.30; // Arena followers take 30% less damage from hero attacks
export const blN = h => h.bleedStacks.length;
export const addBl = (t, time) => { t.bleedStacks.push({ hpSnap: t.hp, at: time, exp: time + 2000 }) };
export function procBl(h, t, dt) { h.bleedStacks = h.bleedStacks.filter(s => t < s.exp); let d = 0; for (const s of h.bleedStacks) d += (s.hpSnap * .01) * (dt / 1000); if (d > 0) h.hp -= d; return d }
export function getMS(h) { let s = h.moveSpeed * (1 + h.moveSpeedBonus); if (h.slow > 0 && state.bt < h.slowEnd) { let sr = h.slow; if (h.type === 'barbarian') sr *= (1 - (CLASSES.barbarian.slowResist || 0)); s *= (1 - sr) } return s }
export function isStunned(h) { return h.stunEnd && state.bt < h.stunEnd && !(h.type === 'barbarian' && CLASSES.barbarian.stunResist && Math.random() < CLASSES.barbarian.stunResist) }
export function getRage(h) { if (h.type !== 'barbarian') return { d: 1, a: 1 }; const c = CLASSES.barbarian, m = 1 - h.hp / h.maxHp; return { d: 1 + m * (c.rageMaxDmg || 0), a: 1 + m * (c.rageMaxAS || 0) } }
export function effAS(h) {
  if (isStunned(h)) return 0.001;
  if (h.type === 'wizard') { let s = h.baseAS * (1 + h.castSpeedBonus); if (h.slow > 0 && state.bt < h.slowEnd) s *= (1 - h.slow); return s }
  if (h.type === 'assassin') { let s = h.baseAS; if (h.combo > 0) s *= (1 + h.combo * 0.06); if (h.slow > 0 && state.bt < h.slowEnd) s *= (1 - h.slow); return s }
  if (h.type === 'barbarian') { let s = h.baseAS * getRage(h).a; if (h.ultActive) s *= (1 + (CLASSES.barbarian.ultAS || 0)); if (h.slow > 0 && state.bt < h.slowEnd) s *= (1 - h.slow * (1 - (CLASSES.barbarian.slowResist || 0))); return s }
  if (h.type === 'custom') { let s = h.baseAS; if (h.ultActive) s *= 1.3; if (h.combo > 0) s *= (1 + h.combo * 0.04); if (h.slow > 0 && state.bt < h.slowEnd) s *= (1 - h.slow); return s }
  let s = h.baseAS * (1 + h.moveSpeedBonus * .5); if (h.blActive) s *= (1 + .05 * blN(en(h))); if (h.ultActive) s *= 3; if (h.slow > 0 && state.bt < h.slowEnd) s *= (1 - h.slow); return s;
}
export function effEv(h) {
  if (h.type === 'ranger' && h.ultActive) return 1;
  let ev = h.evasion; if (h.stealthed) ev += 0.5;
  if (h.smokeBombActive) { const e = en(h); if (Math.abs(e.x - h.smokeBombX) < h.smokeBombRadius) ev += 0.45; }
  return Math.min(ev, 0.95);
}
export function calcDmg(a, d, isRanged, dist) {
  let dm = a.baseDmg * (1 - Math.min(d.def / 300, .8));
  if (d.shocked && state.bt < d.shockedEnd) dm *= 1.1;
  if (isRanged && dist < MELEE) dm *= RANGED_PEN;
  if (a.stealthed) dm *= 3.0;
  if (a.type === 'assassin' && dist <= a.meleeRange) dm *= 1.30;
  if (a.type === 'wizard' && a.charge > 0) dm *= (1 + a.charge * 0.06);
  if (a.type === 'barbarian') { dm *= getRage(a).d; if (a.ultActive) dm *= (1 + (CLASSES.barbarian.ultDmg || 0)); if (CLASSES.barbarian.dmgVariance) dm *= (1 + (Math.random() - .5) * 2 * CLASSES.barbarian.dmgVariance) }
  if (a.type === 'custom' && a.ultActive) dm *= 1.2;
  if (a._stashCrit && Math.random() < a._stashCrit) { dm *= 1.75; spFloat(a.x, a.y - 70, 'CRIT!', '#ffcc22') }
  return dm;
}
export function getSdm(w) { let m = 1 + w.spellDmgBonus; m += w.charge * 0.06; return m }
export function addCh(w, n) { w.charge = Math.min(w.maxCharge, w.charge + n); w.chargeDecayTimer = 0 }

// =============== LOGGING ===============
export function addLog(ms, txt, typ) { state.logs.push({ t: (ms / 1000).toFixed(1), txt, typ }) }

// =============== TARGETING ===============
export function getTarget(atk) {
  const e = en(atk);
  if (e.follower && e.follower.alive && e.follower.goading) { const dF = dst(atk, e.follower); if (dF <= atk.attackRange && dF <= e.follower.goadRange) return { type: 'follower', tgt: e.follower, owner: e } }
  if (e.arenaFollowers) {
    var nearestAF = null, nearD = 99999;
    for (var i = 0; i < e.arenaFollowers.length; i++) {
      var af = e.arenaFollowers[i]; if (!af.alive) continue;
      var d = dst(atk, af); if (d < nearD && d <= atk.attackRange + 20) { nearD = d; nearestAF = af }
    }
    if (nearestAF && (nearD < dst(atk, e) * 0.8 || Math.random() < 0.25)) {
      return { type: 'arenaFollower', tgt: nearestAF, owner: e };
    }
  }
  return { type: 'hero', tgt: e, owner: null };
}

function pickArenaFollowerTarget(af, enemyHero) {
  var best = null, bestDist = 99999;
  if (enemyHero.arenaFollowers) {
    for (var i = 0; i < enemyHero.arenaFollowers.length; i++) {
      var ef = enemyHero.arenaFollowers[i]; if (!ef.alive) continue;
      ef._isArenaFollower = true; ef.def = ef.def || 0;
      var d = dst(af, ef); if (d < bestDist) { bestDist = d; best = ef }
    }
  }
  var heroD = dst(af, enemyHero);
  if (!best || heroD < bestDist * 0.7) { best = enemyHero; best._isArenaFollower = false }
  else { best._isArenaFollower = true }
  return best;
}

// =============== ATTACKS ===============
export function doAttack(h, t) {
  if (isStunned(h)) return false;
  const e = en(h); const d = dst(h, e);
  let atkRange = h.attackRange; if (h.type === 'assassin') atkRange = d <= h.meleeRange ? h.meleeRange : h.throwRange;
  if (d > atkRange + 10 && !(h.type === 'assassin' && d <= h.throwRange)) return false;
  h.atkCnt++; h.attackAnim = 1; const tg = getTarget(h);
  const tx = tg.type === 'follower' ? tg.tgt.x : tg.type === 'arenaFollower' ? tg.tgt.x : e.x;
  const ty = tg.type === 'follower' ? (tg.tgt.y || GY) - 15 : tg.type === 'arenaFollower' ? (tg.tgt.y || GY) - 15 : (e.y || GY) - 35;
  const isMelee = h.type === 'assassin' ? d <= h.meleeRange : (h.type === 'barbarian' ? true : (h.type === 'custom' && state.customChar.rangeType === 'melee' ? true : false));
  if (isMelee) { SFX.hit(); setTimeout(() => resolveHit(h, tg, t, d, false), 80) }
  else {
    const pType = h.type === 'wizard' ? 'bolt' : h.type === 'assassin' ? 'dagger' : 'arrow';
    const pSpeed = h.type === 'wizard' ? 650 : h.type === 'assassin' ? 550 : 520;
    const pCol = h.type === 'custom' ? '#d8b858' : h.type === 'wizard' ? '#6aaa8a' : h.type === 'assassin' ? '#6a9aba' : '#c87a4a';
    state.projectiles.push({ x: h.x, y: (h.y || GY) - 30, tx, ty, speed: pSpeed, color: pCol, type: pType, time: 0, onHit: () => resolveHit(h, tg, t, d, true) });
    if (pType === 'bolt') SFX.bolt(); else if (pType === 'dagger') SFX.dagger(); else SFX.arrow();
  }
  if (h.stealthed) { h.stealthed = false; addLog(t, `${h.name} breaks stealth!`, 'stealth') }
  return true;
}

function resolveHit(atk, tg, t, d, isRanged) {
  const e = en(atk);
  if (tg.type === 'follower') { const fl = tg.tgt; let dm = calcDmg(atk, tg.owner, isRanged, Math.abs(atk.x - fl.x)); fl.hp -= dm; atk.totDmg += dm; fl.hurtAnim = 1; if (atk.blActive) atk.blDmg += dm; spFloat(fl.x, fl.y - 50, `-${Math.round(dm)}`, atk.color); addLog(t, `${atk.name} > Pet ${Math.round(dm)}`, 'dmg'); if (atk.type === 'assassin') atk.combo = Math.min(atk.maxCombo, atk.combo + 1); if (atk.type === 'assassin' && !isRanged && atk.atkCnt % 2 === 0) { addBl(tg.owner, t); spDrips(fl.x, fl.y - 10) } if (fl.hp <= 0) killFollower(tg.owner, t); return }
  if (tg.type === 'arenaFollower') {
    let af = tg.tgt; let afDm = atk.baseDmg * (1 - Math.min(af.def / 300, 0.7)) * (0.85 + Math.random() * 0.3) * (1 - AF_DMG_REDUCTION); afDm = Math.round(afDm);
    af.hp -= afDm; atk.totDmg += afDm; af.hurtAnim = 1;
    spFloat(af.x, af.y - 40, `-${afDm}`, atk.color); addLog(t, `${atk.name} > ${af.name} ${afDm}`, 'dmg');
    if (af.hp <= 0) { af.alive = false; af.hp = 0; spSparks(af.x, af.y - 10, 6, af.color); addLog(t, `${af.name} slain!`, 'summon') }
    return;
  }
  const gHit = atk.markNext; if (!gHit && Math.random() < effEv(e)) { spFloat(e.x, e.y - 60, 'MISS', '#888'); addLog(t, `${atk.name} misses`, 'miss'); return } atk.markNext = false;
  let dm = calcDmg(atk, e, isRanged, d);
  if (e.shieldActive) { const ab = Math.min(dm, e.shieldHp); e.shieldHp -= ab; const c = CLASSES[e.type]; atk.hp -= c.shieldReflect; atk.hurtAnim = 1; dm -= ab; spFloat(e.x, e.y - 60, `Shield -${Math.round(ab)}`, '#88ddff'); spSparks(e.x, e.y - 30, 4, '#88ddff'); addLog(t, `Shield ${Math.round(ab)}, reflect ${c.shieldReflect}`, 'shock'); if (e.shieldHp <= 0) { e.shieldActive = false; SFX.shieldBreak(); addLog(t, `Shield breaks!`, 'spell') } if (dm <= 0) { atk.totDmg += ab; return } }
  if (e.deathMarkTarget && state.bt < e.deathMarkEnd) e.deathMarkDmg += dm;
  e.hp -= dm; atk.totDmg += dm; e.hurtAnim = 1; if (atk.blActive) atk.blDmg += dm;
  const col = atk.stealthed ? '#ffffff' : atk.color; spFloat(e.x, e.y - 60, `-${Math.round(dm)}`, col); addLog(t, `${atk.name} > ${e.name} ${Math.round(dm)}`, 'dmg');
  if (atk.type === 'ranger') { if (atk.atkCnt % 3 === 0) { addBl(e, t); spDrips(e.x, e.y - 20) } if (atk.ultActive) { addBl(e, t); spFire(e.x, e.y - 20, 3) } }
  if (atk.type === 'wizard') addCh(atk, 1);
  if (atk.type === 'assassin') { atk.combo = Math.min(atk.maxCombo, atk.combo + 1); if (!isRanged && atk.atkCnt % 2 === 0) { addBl(e, t); spDrips(e.x, e.y - 20) } if (atk.envenomed && state.bt < atk.envenomedEnd) { addBl(e, t); spPoison(e.x, e.y - 20, 3) } }
  if (atk.type === 'custom') { if (atk.envenomed && state.bt < atk.envenomedEnd) { addBl(e, t); spPoison(e.x, e.y - 20, 2) } atk.combo = Math.min(atk.maxCombo || 5, (atk.combo || 0) + 0.5) }
  if (atk.type === 'barbarian') { const c = CLASSES.barbarian; let ls = dm * (c.lifesteal + (atk.ultActive ? (c.ultLifesteal || 0) : 0)); if (ls > 0) { atk.hp = Math.min(atk.maxHp, atk.hp + ls); atk.totHeal += ls } }
  if (atk._stashLifesteal && atk._stashLifesteal > 0) { let sls = dm * atk._stashLifesteal; atk.hp = Math.min(atk.maxHp, atk.hp + sls); atk.totHeal += sls }
}

function killFollower(owner, t) { if (!owner.follower) return; owner.follower.alive = false; owner.followerAlive = false; spSparks(owner.follower.x, owner.follower.y - 15, 8, '#cc88ff'); addLog(t, `${owner.name}'s pet slain!`, 'summon'); if (owner.blActive) { owner.blEnd += 500 } }

export function checkDeath(h, t) { if (h.hp <= 0) { h.hp = 0; state.over = true; SFX.death(); addLog(t, `\u2620 ${h.name} slain! ${en(h).name} WINS!`, 'death'); if (state._showWinFn) state._showWinFn(en(h)); return true } return false }

// =============== MAIN TICK ===============
export function tick() {
  if (state.over) return; const dt = TK; state.bt += dt; const dts = dt / 1000;
  const { h1, h2 } = state;
  for (const h of [h1, h2]) {
    tickCD(h, dt); procExp(h, state.bt); procRes(h, dt);
    if (h.type === 'wizard') procWizUlt(h, state.bt, dt);
    if (h.type === 'custom' && h.customUltId !== null && ALL_ULTS[h.customUltId]) { var u = ALL_ULTS[h.customUltId]; if (u && u.proc) try { u.proc(h, state.bt, dt) } catch (e) { } }
    procBl(h, state.bt, dt); if (checkDeath(h, state.bt)) return;
    moveAI(h, dt); if (h.follower && h.follower.alive) moveFollower(h.follower, h, en(h), dt);
    spellAI(h, state.bt);
    const as = effAS(h), intMs = 1000 / as; h.atkCd -= dt;
    if (h.atkCd <= 0) { const hit = doAttack(h, state.bt); h.atkCd = hit ? intMs : 80; if (!state.over && checkDeath(en(h), state.bt)) return }
  }
  // Arena follower tick
  for (const h of [h1, h2]) {
    if (!h.arenaFollowers) continue;
    var enemy = en(h);
    for (var fi = 0; fi < h.arenaFollowers.length; fi++) {
      var af = h.arenaFollowers[fi]; if (!af.alive) continue;
      var tgt = pickArenaFollowerTarget(af, enemy);
      if (tgt) {
        var dx = tgt.x - af.x, dist = dst(af, tgt), dirX = dx > 0 ? 1 : -1;
        if (dist > af.attackRange) {
          af.x += dirX * af.moveSpeed * dts; af.x = Math.max(AX + 15, Math.min(AX + AW - 15, af.x));
          var dy = (tgt.y || GY) - (af.y || GY);
          if (Math.abs(dy) > 5) af.y = (af.y || GY) + (dy > 0 ? 1 : -1) * af.moveSpeed * dts * 0.5;
          af.y = Math.max(GY_MIN, Math.min(GY_MAX, af.y || GY));
        }
        af.atkCd -= dt;
        if (af.atkCd <= 0 && dist <= af.attackRange + 15) {
          af.atkCd = 1000 / af.baseAS; af.attackAnim = 1;
          var afDef = tgt.def || 0;
          if (tgt._debuffs) tgt._debuffs.forEach(function (db) { if (db.type === 'def' && state.bt < db.end) afDef += db.val });
          var dm = af.baseDmg * (1 - Math.min(Math.max(0, afDef) / 300, 0.7));
          dm *= (0.85 + Math.random() * 0.3); dm = Math.round(dm);
          tgt.hp -= dm; af.totDmg += dm; tgt.hurtAnim = 1;
          spFloat(tgt.x, tgt.y - (tgt.maxHp ? 50 : 30), '-' + dm, af.color);
          SFX.followerAtk();
          if (af.isRanged) { state.projectiles.push({ x: af.x, y: (af.y || GY) - 15, tx: tgt.x, ty: (tgt.y || GY) - (tgt.maxHp ? 30 : 10), speed: 400, color: af.color, type: 'bolt', time: 0, onHit: function () { } }) }
          if (tgt._isArenaFollower && tgt.hp <= 0) {
            var revived = false;
            if (tgt.onDeath) { revived = tgt.onDeath(tgt, state.bt) }
            if (!revived) { tgt.alive = false; tgt.hp = 0; spSparks(tgt.x, tgt.y - 10, 6, tgt.color); addLog(state.bt, af.name + ' slays ' + tgt.name + '!', 'summon') }
          }
          if (!tgt._isArenaFollower && tgt.hp <= 0) {
            if (checkDeath(enemy, state.bt)) return;
          }
        }
        if (af.abilityFn) {
          af.abilityCd -= dt;
          if (af.abilityCd <= 0 && tgt) {
            af.abilityCd = af.abilityBcd;
            SFX.followerAbility();
            try { af.abilityFn(af, tgt._isArenaFollower ? tgt : (enemy), state.bt) } catch (e) { }
            af.attackAnim = 1;
            if (enemy.hp <= 0) { if (checkDeath(enemy, state.bt)) return }
            if (tgt._isArenaFollower && tgt.hp <= 0) {
              var rev2 = false; if (tgt.onDeath) rev2 = tgt.onDeath(tgt, state.bt);
              if (!rev2) { tgt.alive = false; tgt.hp = 0; spSparks(tgt.x, tgt.y - 10, 4, tgt.color) }
            }
          }
        }
      }
      af.bobPhase += dts * 4;
      if (af.attackAnim > 0) af.attackAnim = Math.max(0, af.attackAnim - dts * 5);
      if (af.hurtAnim > 0) af.hurtAnim = Math.max(0, af.hurtAnim - dts * 4);
    }
  }
  // Hero animations
  for (const h of [h1, h2]) { h.bobPhase += dts * 3; if (h.attackAnim > 0) h.attackAnim = Math.max(0, h.attackAnim - dts * 5); if (h.hurtAnim > 0) h.hurtAnim = Math.max(0, h.hurtAnim - dts * 4); if (h.castAnim > 0) h.castAnim = Math.max(0, h.castAnim - dts * 3); if (h.follower && h.follower.alive) { h.follower.bobPhase += dts * 4; if (h.follower.hurtAnim > 0) h.follower.hurtAnim = Math.max(0, h.follower.hurtAnim - dts * 4) } }
  updParticles(dts);
}
