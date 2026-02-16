// =============== CHARACTER SHEET COMPONENT ===============
import { state } from '../gameState.js';
import { ITEMS, EQ_SLOTS, GEAR_RARITY_COLORS, gearTemplate } from '../data/items.js';
import { ALL_SKILLS, ALL_ULTS } from '../data/skills.js';
import { getIcon } from './icons.js';
import { getCustomTotalStats, getWeaponRangeType } from '../combat/hero.js';
import { drawSpritePreview } from './sprites.js';
import { openCustomEditor } from '../custom.js';
import { attachTooltip, buildGearTooltipHtml, buildSkillTooltipHtml } from '../tooltip.js';

// Class display names
var CLASS_NAMES = {
  wizard: 'Mage', ranger: 'Ranger', assassin: 'Rogue', barbarian: 'Warrior'
};

export function buildCharSheet(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';

  var cs = getCustomTotalStats();
  var rangeType = getWeaponRangeType();
  var className = CLASS_NAMES[state.customChar.sprite] || 'Custom';

  // Build the sheet
  var sheet = document.createElement('div');
  sheet.className = 'char-sheet';

  // Header
  var header = document.createElement('div');
  header.className = 'char-sheet-header';
  header.innerHTML = '<div class="char-sheet-name">\u2694 ' + (state.customChar.name || 'Hero') + '</div>' +
    '<div class="char-sheet-class">' + className + ' \u2014 ' + rangeType + '</div>';
  sheet.appendChild(header);

  // Sprite area
  var spriteArea = document.createElement('div');
  spriteArea.className = 'char-sheet-sprite';
  var canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 280;
  canvas.style.width = '240px';
  canvas.style.height = '280px';
  canvas.style.imageRendering = 'pixelated';
  spriteArea.appendChild(canvas);
  sheet.appendChild(spriteArea);

  // Body (stats + equipment + skills)
  var body = document.createElement('div');
  body.className = 'char-sheet-body';

  // Stats section
  body.innerHTML += '<div class="char-sheet-section">STATS</div>';
  var statsHtml = '<div class="char-sheet-stats">';
  statsHtml += '<div class="char-sheet-stat"><span class="char-sheet-stat-label">HP</span><span class="char-sheet-stat-val">' + Math.round(cs.hp) + '</span></div>';
  statsHtml += '<div class="char-sheet-stat"><span class="char-sheet-stat-label">DMG</span><span class="char-sheet-stat-val">' + Math.round(cs.baseDmg) + '</span></div>';
  statsHtml += '<div class="char-sheet-stat"><span class="char-sheet-stat-label">AS</span><span class="char-sheet-stat-val">' + cs.baseAS.toFixed(2) + '</span></div>';
  statsHtml += '<div class="char-sheet-stat"><span class="char-sheet-stat-label">DEF</span><span class="char-sheet-stat-val">' + Math.round(cs.def) + '</span></div>';
  statsHtml += '<div class="char-sheet-stat"><span class="char-sheet-stat-label">EVA</span><span class="char-sheet-stat-val">' + Math.round(cs.evasion * 100) + '%</span></div>';
  statsHtml += '<div class="char-sheet-stat"><span class="char-sheet-stat-label">SPD</span><span class="char-sheet-stat-val">' + Math.round(cs.moveSpeed) + '</span></div>';
  statsHtml += '</div>';
  body.innerHTML += statsHtml;

  // Equipment section
  body.innerHTML += '<div class="char-sheet-section">EQUIPMENT</div>';
  var equipHtml = '<div class="char-sheet-equip">';
  EQ_SLOTS.forEach(function (slot) {
    var entry = state.customChar.equipment[slot.key];
    var tmpl = gearTemplate(entry);
    if (tmpl) {
      var col = GEAR_RARITY_COLORS[tmpl.rarity] || '#8a8a7a';
      equipHtml += '<div class="char-sheet-equip-slot">' +
        '<span class="char-sheet-equip-icon">' + getIcon(tmpl, 18) + '</span>' +
        '<span class="char-sheet-equip-name" style="color:' + col + '">' + tmpl.name + '</span>' +
        '</div>';
    } else {
      equipHtml += '<div class="char-sheet-equip-slot">' +
        '<span class="char-sheet-equip-icon">' + getIcon(slot, 16) + '</span>' +
        '<span class="char-sheet-equip-empty">' + slot.label + '</span>' +
        '</div>';
    }
  });
  equipHtml += '</div>';
  body.innerHTML += equipHtml;

  // Skills section
  body.innerHTML += '<div class="char-sheet-section">ABILITIES</div>';
  var skillsHtml = '<div class="char-sheet-skills">';
  for (var i = 0; i < 2; i++) {
    var si = state.customChar.skills[i];
    if (si !== null && ALL_SKILLS[si]) {
      skillsHtml += '<div class="char-sheet-skill"><span class="char-sheet-skill-icon">' + ALL_SKILLS[si].icon + '</span>' + ALL_SKILLS[si].name + '</div>';
    }
  }
  if (state.customChar.ultimate !== null && ALL_ULTS[state.customChar.ultimate]) {
    var ult = ALL_ULTS[state.customChar.ultimate];
    skillsHtml += '<div class="char-sheet-skill char-sheet-skill-ult"><span class="char-sheet-skill-icon">' + ult.icon + '</span>' + ult.name + ' (Ult)</div>';
  }
  if (skillsHtml === '<div class="char-sheet-skills">') {
    skillsHtml += '<div class="char-sheet-skill" style="color:var(--text-dim);font-style:italic">No abilities</div>';
  }
  skillsHtml += '</div>';
  body.innerHTML += skillsHtml;

  sheet.appendChild(body);

  // Footer with edit button
  var footer = document.createElement('div');
  footer.className = 'char-sheet-footer';
  var editBtn = document.createElement('button');
  editBtn.className = 'char-sheet-edit-btn';
  editBtn.textContent = '\u2699 Edit Hero';
  editBtn.onclick = function (e) {
    e.stopPropagation();
    openCustomEditor('p1');
  };
  footer.appendChild(editBtn);
  sheet.appendChild(footer);

  el.appendChild(sheet);

  // Attach tooltips to equipment slots
  var equipSlots = sheet.querySelectorAll('.char-sheet-equip-slot');
  EQ_SLOTS.forEach(function(slot, idx) {
    var entry = state.customChar.equipment[slot.key];
    if (entry && equipSlots[idx]) attachTooltip(equipSlots[idx], (function(e) { return function() { return buildGearTooltipHtml(e) } })(entry));
  });
  // Attach tooltips to skill entries
  var skillEls = sheet.querySelectorAll('.char-sheet-skill');
  var ti = 0;
  for (var si = 0; si < 2; si++) {
    if (state.customChar.skills[si] !== null && ALL_SKILLS[state.customChar.skills[si]]) {
      if (skillEls[ti]) attachTooltip(skillEls[ti], (function(idx) { return function() { return buildSkillTooltipHtml(idx, false) } })(state.customChar.skills[si]));
      ti++;
    }
  }
  if (state.customChar.ultimate !== null && ALL_ULTS[state.customChar.ultimate]) {
    if (skillEls[ti]) attachTooltip(skillEls[ti], (function(idx) { return function() { return buildSkillTooltipHtml(idx, true) } })(state.customChar.ultimate));
  }

  // Draw sprite preview on the canvas with equipped gear
  drawSpritePreview(canvas, state.customChar.sprite, state.customChar.equipment);
}
