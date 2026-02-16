// =============== TOOLTIP SYSTEM ===============
// Hover (desktop) / Long-press (mobile) tooltips for gear, skills, followers.

import { state } from './gameState.js';
import { ITEMS, GEAR_RARITY_COLORS } from './data/items.js';
import { ALL_SKILLS, ALL_ULTS } from './data/skills.js';
import { RARITY_COLORS } from './data/followers.js';

// ---- Tooltip DOM ----
var tip = document.createElement('div');
tip.className = 'game-tooltip';
tip.style.display = 'none';
document.body.appendChild(tip);

var _holdTimer = null;
var _tooltipShowing = false;
var _currentTarget = null;

// ---- Show / Hide ----
function showTooltip(el, html) {
  tip.innerHTML = html;
  tip.style.display = 'block';
  var rect = el.getBoundingClientRect();
  var tw = tip.offsetWidth, th = tip.offsetHeight;
  var vw = window.innerWidth, vh = window.innerHeight;

  // Prefer above, fall back below
  var top = rect.top - th - 6;
  if (top < 8) top = rect.bottom + 6;
  if (top + th > vh - 8) top = vh - th - 8;

  // Center horizontally, clamp to viewport
  var left = rect.left + rect.width / 2 - tw / 2;
  if (left < 8) left = 8;
  if (left + tw > vw - 8) left = vw - tw - 8;

  tip.style.top = top + 'px';
  tip.style.left = left + 'px';
  _tooltipShowing = true;
  _currentTarget = el;
}

function hideTooltip() {
  tip.style.display = 'none';
  _tooltipShowing = false;
  _currentTarget = null;
}

// ---- Attach ----
export function attachTooltip(el, contentFn) {
  // Desktop: hover
  el.addEventListener('mouseenter', function () {
    if (state.isMobile) return;
    var html = contentFn();
    if (html) showTooltip(el, html);
  });
  el.addEventListener('mouseleave', function () {
    if (state.isMobile) return;
    hideTooltip();
  });

  // Mobile: long-press
  var startX, startY;
  el.addEventListener('touchstart', function (e) {
    if (!state.isMobile) return;
    var touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    clearTimeout(_holdTimer);
    _holdTimer = setTimeout(function () {
      var html = contentFn();
      if (html) showTooltip(el, html);
    }, 400);
  }, { passive: true });
  el.addEventListener('touchmove', function (e) {
    if (!state.isMobile || !_holdTimer) return;
    var touch = e.touches[0];
    if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
      clearTimeout(_holdTimer);
      _holdTimer = null;
    }
  }, { passive: true });
  el.addEventListener('touchend', function (e) {
    clearTimeout(_holdTimer);
    _holdTimer = null;
    if (_tooltipShowing && _currentTarget === el) {
      hideTooltip();
      e.preventDefault();
    }
  });
}

// Hide tooltip on any outside tap (mobile)
document.addEventListener('touchstart', function (e) {
  if (_tooltipShowing && _currentTarget && !_currentTarget.contains(e.target)) {
    hideTooltip();
  }
}, { passive: true });

// ---- Stat label helper ----
var STAT_LABELS = {
  hp: 'HP', baseDmg: 'DMG', baseAS: 'AS', def: 'DEF',
  evasion: 'EVA', moveSpeed: 'SPD', mana: 'Mana',
  manaRegen: 'Mana/s', energy: 'Energy', energyRegen: 'Eng/s',
  spellDmgBonus: 'Spell%'
};

function fmtStat(key, val) {
  if (key === 'evasion' || key === 'spellDmgBonus') return Math.round(val * 100) + '%';
  if (key === 'baseAS') return val.toFixed(2);
  return Math.round(val).toString();
}

// ---- Gear Tooltip ----
export function buildGearTooltipHtml(itemKey) {
  var item = ITEMS[itemKey];
  if (!item) return '';
  var col = GEAR_RARITY_COLORS[item.rarity] || '#aaa';

  var h = '<div class="tt-header" style="color:' + col + '">' + item.icon + ' ' + item.name + '</div>';
  h += '<div class="tt-rarity" style="color:' + col + '">' + item.rarity + ' ' + item.slot + '</div>';
  if (item.rangeType) h += '<div style="font-size:.42rem;color:var(--text-dim)">' + item.rangeType + '</div>';
  h += '<div class="tt-divider"></div>';
  h += '<div class="tt-section">Stats</div>';

  for (var k in item.stats) {
    var val = item.stats[k];
    if (val === 0) continue;
    var sign = val > 0 ? '+' : '';
    h += '<div class="tt-stat"><span class="tt-stat-label">' + (STAT_LABELS[k] || k) + '</span><span class="tt-stat-val">' + sign + fmtStat(k, val) + '</span></div>';
  }

  // Comparison to equipped
  var equippedKey = state.customChar.equipment[item.slot];
  if (equippedKey && equippedKey !== itemKey) {
    var cur = ITEMS[equippedKey];
    if (cur) {
      var curCol = GEAR_RARITY_COLORS[cur.rarity] || '#aaa';
      h += '<div class="tt-compare">';
      h += '<div style="margin-bottom:2px">vs <span style="color:' + curCol + '">' + cur.name + '</span></div>';
      var allKeys = {};
      for (var k2 in item.stats) allKeys[k2] = true;
      for (var k3 in cur.stats) allKeys[k3] = true;
      var diffs = [];
      for (var sk in allKeys) {
        var nv = item.stats[sk] || 0, cv = cur.stats[sk] || 0, diff = nv - cv;
        if (diff !== 0) {
          var cls = diff > 0 ? 'tt-diff-pos' : 'tt-diff-neg';
          var sign2 = diff > 0 ? '+' : '';
          diffs.push('<span class="' + cls + '">' + sign2 + fmtStat(sk, diff) + ' ' + (STAT_LABELS[sk] || sk) + '</span>');
        }
      }
      h += diffs.join(' ');
      h += '</div>';
    }
  } else if (!equippedKey) {
    h += '<div class="tt-compare" style="color:#6a9a6a">No item in ' + item.slot + ' slot</div>';
  }

  return h;
}

// ---- Skill Tooltip ----
export function buildSkillTooltipHtml(skillIdx, isUlt) {
  var sk = isUlt ? ALL_ULTS[skillIdx] : ALL_SKILLS[skillIdx];
  if (!sk) return '';

  var h = '<div class="tt-header">' + sk.icon + ' ' + sk.name + '</div>';
  h += '<div style="font-size:.42rem;color:var(--gold)">' + sk.source + '</div>';
  h += '<div class="tt-divider"></div>';
  h += '<div class="tt-desc">' + sk.desc + '</div>';

  if (!isUlt) {
    h += '<div class="tt-divider"></div>';
    var cdText = sk.bcd >= 999999 ? 'N/A' : (sk.bcd / 1000) + 's';
    h += '<div class="tt-stat"><span class="tt-stat-label">Cooldown</span><span class="tt-stat-val">' + cdText + '</span></div>';
    if (sk.cost > 0) {
      h += '<div class="tt-stat"><span class="tt-stat-label">Cost</span><span class="tt-stat-val">' + sk.cost + '</span></div>';
    } else {
      h += '<div class="tt-stat"><span class="tt-stat-label">Cost</span><span class="tt-stat-val" style="color:#6a9a6a">Free</span></div>';
    }
  } else {
    h += '<div class="tt-divider"></div>';
    h += '<div class="tt-stat"><span class="tt-stat-label">Trigger</span><span class="tt-stat-val">' + Math.round(sk.threshold * 100) + '% HP</span></div>';
    h += '<div class="tt-stat"><span class="tt-stat-label">Use</span><span class="tt-stat-val">Once per fight</span></div>';
  }

  return h;
}

// ---- Follower Tooltip ----
export function buildFollowerTooltipHtml(f) {
  if (!f) return '';
  var col = RARITY_COLORS[f.rarity] || '#aaa';

  var h = '<div class="tt-header" style="color:' + col + '">' + f.icon + ' ' + f.name + '</div>';
  h += '<div class="tt-rarity" style="color:' + col + '">' + f.rarity + '</div>';
  h += '<div class="tt-divider"></div>';
  h += '<div class="tt-section">Combat Stats</div>';
  h += '<div class="tt-stat"><span class="tt-stat-label">HP</span><span class="tt-stat-val">' + f.combatHp + '</span></div>';
  h += '<div class="tt-stat"><span class="tt-stat-label">DMG</span><span class="tt-stat-val">' + f.combatDmg + '</span></div>';
  h += '<div class="tt-stat"><span class="tt-stat-label">AS</span><span class="tt-stat-val">' + f.combatAS.toFixed(1) + '</span></div>';
  h += '<div class="tt-stat"><span class="tt-stat-label">DEF</span><span class="tt-stat-val">' + f.combatDef + '</span></div>';
  h += '<div class="tt-stat"><span class="tt-stat-label">Range</span><span class="tt-stat-val">' + (f.combatRange || 60) + '</span></div>';

  h += '<div class="tt-divider"></div>';
  h += '<div class="tt-section">Buff</div>';
  h += '<div class="tt-desc">' + f.buffDesc + '</div>';

  if (f.abilityName) {
    h += '<div class="tt-divider"></div>';
    h += '<div class="tt-section">Ability</div>';
    h += '<div class="tt-desc" style="color:#88ccaa">' + f.abilityName + ': ' + f.abilityDesc + '</div>';
  }

  if (f.wagerDebuffName) {
    h += '<div class="tt-divider"></div>';
    h += '<div class="tt-section">Wager Debuff</div>';
    h += '<div class="tt-desc" style="color:#cc8866">' + f.wagerDebuffName + ': ' + f.wagerDebuffDesc + '</div>';
  }

  return h;
}

// ---- Run Item Tooltip ----
export function buildRunItemTooltipHtml(name, desc) {
  var h = '<div class="tt-header">' + name + '</div>';
  h += '<div class="tt-divider"></div>';
  h += '<div class="tt-desc">' + desc + '</div>';
  return h;
}
