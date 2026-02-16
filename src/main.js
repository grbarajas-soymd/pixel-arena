// =============== MAIN ENTRY POINT ===============
// Vite entry: imports all modules, initializes game, sets up window exports.

import './styles.css';
import { state } from './gameState.js';
import { STARTER_LOADOUTS } from './data/items.js';

// Persistence
import {
  loadSaveWrapper, loadCharacterSlot, createCharacterSlot,
  deleteCharacterSlot, getSaveData, saveGame, setupAutoSave, showSaveToast
} from './persistence.js';

// Mode modules
import {
  buildSelector, launchBattle, backToSelect, startBattle, resetBattle,
  showWin, setSpd, toggleSound, cycleBiome, switchMode,
  registerPlayer, uploadBuild, refreshOpponents
} from './modes/arena.js';
import { startLadder, ladderContinue, ladderQuit, ladderFight } from './modes/ladder.js';
import {
  startDungeon, abandonDungeon, buildDungeonPicker,
  dgKeepFollower, dgSellFollower, dgUsePotion, dgFlee,
  dgTakeTreasure, dgTriggerTrap, dgDodgeTrap, dgRest, dgSkipRest,
  dgUseShrine, dgBuyItem,
  generateRoom, dgProceedToLoot, dgProceedToCapture, endDungeonRun, dgVictory,
  _dgActualGenerateRoom, dgEquipGearDrop, dgStashGearDrop, dgBuyGear,
  dgDeployFollower
} from './modes/dungeon.js';

// Custom character editor
import {
  saveCustomAndBack, cancelCustom, openSkillPicker, closeDD,
  openCustomEditor, applyClassDefaults
} from './custom.js';

// Render
import { render } from './render/arena.js';
import { updateFollowerDisplays, updateStakeUI } from './render/ui.js';
import { drawSpritePreview } from './render/sprites.js';

// Tooltip system
import './tooltip.js';

// =============== DEVICE DETECTION ===============
function detectLayout() {
  var w = window.innerWidth, h = window.innerHeight;
  var isPortrait = h > w;
  var isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  var isTablet = isTouch && Math.min(w, h) >= 600;
  var isMobile = isTouch ? (isTablet ? isPortrait : true) : (w < 768);
  document.body.classList.toggle('is-mobile', isMobile);
  document.body.classList.toggle('is-desktop', !isMobile);
  state.isMobile = isMobile;
}
window.addEventListener('resize', detectLayout);
window.addEventListener('orientationchange', function(){ setTimeout(detectLayout, 100); });
detectLayout();

// =============== START SCREEN ===============
function drawLogo(canvas) {
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.font = 'bold 28px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8a7a52';
  ctx.fillText('\u2694', w / 2 - 155, h / 2);
  ctx.fillText('\u2694', w / 2 + 155, h / 2);
  ctx.font = 'bold 48px "Cinzel"';
  ctx.shadowColor = 'rgba(200,168,72,0.4)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#c8a848';
  ctx.fillText('PIXEL ARENA', w / 2, h / 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#d8b858';
  ctx.fillText('PIXEL ARENA', w / 2, h / 2);
  ctx.strokeStyle = 'rgba(200,168,72,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 130, h / 2 + 28);
  ctx.lineTo(w / 2 + 130, h / 2 + 28);
  ctx.stroke();
}

function initStartScreen() {
  var skipStart = localStorage.getItem('pixel-arena-skip-start') === '1';
  if (!skipStart) {
    document.querySelector('.app').style.display = 'none';
    drawLogo(document.getElementById('logoCanvas'));
  } else {
    document.getElementById('startScreen').style.display = 'none';
    initCharacterFlow();
  }
}

function dismissStartScreen() {
  document.getElementById('startScreen').style.display = 'none';
  document.querySelector('.app').style.display = '';
  if (document.getElementById('skipStartCheck').checked) {
    localStorage.setItem('pixel-arena-skip-start', '1');
  }
  initCharacterFlow();
}
window.dismissStartScreen = dismissStartScreen;

// =============== CHARACTER FLOW ===============

var CLASS_NAMES = {
  wizard: 'Mage', ranger: 'Ranger', assassin: 'Rogue', barbarian: 'Warrior'
};

function initCharacterFlow() {
  var wrapper = loadSaveWrapper();
  if (wrapper && wrapper.slots && wrapper.slots.length > 0) {
    showCharacterSelect();
  } else {
    // No saves — show archetype picker for first character
    document.getElementById('archetypeOverlay').style.display = 'flex';
  }
}

function timeAgo(isoStr) {
  if (!isoStr) return '';
  var diff = Date.now() - new Date(isoStr).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  var days = Math.floor(hrs / 24);
  return days + 'd ago';
}

function showCharacterSelect() {
  // Warn if in active run
  if (state._activeSlotIndex !== null && (state.dgRun || state.ladderRun)) {
    if (!confirm('You have an active run in progress. Switch characters? (Run progress will be lost)')) return;
    state.dgRun = null;
    state.ladderRun = null;
  }
  // Save current character if one is active
  if (state._activeSlotIndex !== null) {
    saveGame();
  }

  var wrapper = getSaveData();
  var slots = wrapper ? wrapper.slots : [];
  var grid = document.getElementById('charSlotGrid');
  var footer = document.getElementById('charSelectFooter');
  grid.innerHTML = '';
  footer.innerHTML = '';

  // Render existing character cards
  for (var i = 0; i < slots.length; i++) {
    (function(idx) {
      var slot = slots[idx];
      var card = document.createElement('div');
      card.className = 'char-slot-card';
      card.style.position = 'relative';

      // Sprite preview
      var canvas = document.createElement('canvas');
      canvas.width = 120; canvas.height = 140;
      canvas.style.width = '60px'; canvas.style.height = '70px';
      canvas.style.imageRendering = 'pixelated';
      card.appendChild(canvas);

      // Draw sprite after a tiny delay so canvas is in DOM
      setTimeout(function() {
        if (slot.customChar) {
          drawSpritePreview(canvas, slot.sprite || 'wizard', slot.customChar.equipment || {});
        }
      }, 10);

      // Name
      var nameEl = document.createElement('div');
      nameEl.className = 'char-slot-name';
      nameEl.textContent = slot.name || 'Hero';
      card.appendChild(nameEl);

      // Class
      var classEl = document.createElement('div');
      classEl.className = 'char-slot-class';
      classEl.textContent = CLASS_NAMES[slot.sprite] || 'Custom';
      card.appendChild(classEl);

      // Info
      var infoEl = document.createElement('div');
      infoEl.className = 'char-slot-info';
      var followerCount = slot.p1Collection ? slot.p1Collection.length : 0;
      var gearCount = slot.gearBag ? slot.gearBag.length : 0;
      infoEl.textContent = followerCount + ' followers \u00B7 ' + gearCount + ' gear';
      card.appendChild(infoEl);

      // Time
      var timeEl = document.createElement('div');
      timeEl.className = 'char-slot-time';
      timeEl.textContent = timeAgo(slot.savedAt);
      card.appendChild(timeEl);

      // Delete button
      var delBtn = document.createElement('button');
      delBtn.className = 'char-slot-delete';
      delBtn.textContent = '\u2715';
      delBtn.title = 'Delete ' + (slot.name || 'Hero');
      delBtn.onclick = function(e) {
        e.stopPropagation();
        deleteCharacter(idx);
      };
      card.appendChild(delBtn);

      // Click to select
      card.onclick = function() { selectCharacter(idx); };
      grid.appendChild(card);
    })(i);
  }

  // "New Hero" card (if under max)
  if (slots.length < 4) {
    var newCard = document.createElement('div');
    newCard.className = 'char-slot-card char-slot-empty';
    newCard.innerHTML = '<div style="font-size:1.5rem;color:var(--gold);margin:16px 0">+</div>' +
      '<div class="char-slot-name">New Hero</div>' +
      '<div class="char-slot-class">Create a new character</div>';
    newCard.onclick = function() { createNewCharacter(); };
    grid.appendChild(newCard);
  }

  // Footer: Delete All
  if (slots.length > 0) {
    var delAll = document.createElement('button');
    delAll.className = 'btn btn-back';
    delAll.style.fontSize = '.4rem';
    delAll.style.opacity = '0.5';
    delAll.style.marginTop = '4px';
    delAll.textContent = '\uD83D\uDD04 Delete All Characters';
    delAll.onclick = function() { resetAllCharacters(); };
    footer.appendChild(delAll);
  }

  document.getElementById('charSelectOverlay').style.display = 'flex';
}
window.showCharacterSelect = showCharacterSelect;

function selectCharacter(slotIndex) {
  loadCharacterSlot(slotIndex);
  document.getElementById('charSelectOverlay').style.display = 'none';
  // Make sure app is visible
  document.querySelector('.app').style.display = '';
  // Rebuild UI
  buildDungeonPicker();
  updateFollowerDisplays();
  switchMode('dungeon');
}
window.selectCharacter = selectCharacter;

function createNewCharacter() {
  document.getElementById('charSelectOverlay').style.display = 'none';
  var nameInput = document.getElementById('newCharName');
  if (nameInput) nameInput.value = '';
  document.getElementById('archetypeOverlay').style.display = 'flex';
}
window.createNewCharacter = createNewCharacter;

function deleteCharacter(slotIndex) {
  var wrapper = getSaveData();
  if (!wrapper || !wrapper.slots[slotIndex]) return;
  var name = wrapper.slots[slotIndex].name || 'Hero';
  if (!confirm('Delete ' + name + '? All gear, followers, and progress will be lost.')) return;

  var remaining = deleteCharacterSlot(slotIndex);

  // If deleted the active character, clear active index
  if (state._activeSlotIndex === slotIndex) {
    state._activeSlotIndex = null;
  } else if (state._activeSlotIndex !== null && state._activeSlotIndex > slotIndex) {
    state._activeSlotIndex--;
  }

  if (remaining > 0) {
    showCharacterSelect();
  } else {
    // No characters left — show creation
    document.getElementById('charSelectOverlay').style.display = 'none';
    var nameInput = document.getElementById('newCharName');
    if (nameInput) nameInput.value = '';
    document.getElementById('archetypeOverlay').style.display = 'flex';
  }
}
window.deleteCharacter = deleteCharacter;

function resetAllCharacters() {
  if (confirm('Delete ALL characters? This cannot be undone.')) {
    state._resetting = true;
    localStorage.removeItem('pixel-arena-save');
    location.reload();
  }
}
window.resetAllCharacters = resetAllCharacters;

// =============== INITIALIZATION ===============
state.canvas = document.getElementById('arenaCanvas');
state.ctx = state.canvas.getContext('2d');

// Set default showWin handler (arena's version handles wager transfers)
state._showWinFn = showWin;

// Force single-player custom character
state.p1Class = 'custom';

initStartScreen();

function pickArchetype(arch) {
  var nameInput = document.getElementById('newCharName');
  var name = nameInput ? nameInput.value : '';

  var idx = createCharacterSlot(name, arch);
  if (idx < 0) return;

  loadCharacterSlot(idx);
  document.getElementById('archetypeOverlay').style.display = 'none';
  // Make sure app is visible
  document.querySelector('.app').style.display = '';
  buildDungeonPicker();
  updateFollowerDisplays();
  showSaveToast();
}
window.pickArchetype = pickArchetype;

function showArchetypePicker() {
  document.getElementById('archetypeOverlay').style.display = 'flex';
}
window.showArchetypePicker = showArchetypePicker;

// Keep resetGame for backwards compat (used nowhere in HTML now, but just in case)
function resetGame() {
  resetAllCharacters();
}
window.resetGame = resetGame;

// Start render loop
render();

// Auto-save on page unload
setupAutoSave();

// =============== WINDOW EXPORTS FOR HTML ONCLICK HANDLERS ===============
window.switchMode = switchMode;
window.launchBattle = launchBattle;
window.backToSelect = backToSelect;
window.startBattle = startBattle;
window.resetBattle = resetBattle;
window.setSpd = setSpd;
window.toggleSound = toggleSound;
window.cycleBiome = cycleBiome;
window.saveCustomAndBack = saveCustomAndBack;
window.cancelCustom = cancelCustom;
window.openSkillPicker = openSkillPicker;
window.openCustomEditor = openCustomEditor;
window.closeDD = closeDD;
window.applyClassDefaults = applyClassDefaults;
window.startDungeon = startDungeon;
window.abandonDungeon = abandonDungeon;
window.startLadder = startLadder;
window.ladderContinue = ladderContinue;
window.ladderQuit = ladderQuit;
window.ladderFight = ladderFight;
window.dgKeepFollower = dgKeepFollower;
window.dgSellFollower = dgSellFollower;
window.dgUsePotion = dgUsePotion;
window.dgFlee = dgFlee;
window.dgTakeTreasure = dgTakeTreasure;
window.dgTriggerTrap = dgTriggerTrap;
window.dgDodgeTrap = dgDodgeTrap;
window.dgRest = dgRest;
window.dgSkipRest = dgSkipRest;
window.dgUseShrine = dgUseShrine;
window.dgBuyItem = dgBuyItem;
window.dgBuyGear = dgBuyGear;
window.generateRoom = generateRoom;
window.dgProceedToLoot = dgProceedToLoot;
window.dgProceedToCapture = dgProceedToCapture;
window.endDungeonRun = endDungeonRun;
window.dgVictory = dgVictory;
window._dgActualGenerateRoom = _dgActualGenerateRoom;
window.dgEquipGearDrop = dgEquipGearDrop;
window.dgStashGearDrop = dgStashGearDrop;
window.dgDeployFollower = dgDeployFollower;
window.registerPlayer = registerPlayer;
window.uploadBuild = uploadBuild;
window.refreshOpponents = refreshOpponents;
