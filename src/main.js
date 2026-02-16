// =============== MAIN ENTRY POINT ===============
// Vite entry: imports all modules, initializes game, sets up window exports.

import './styles.css';
import { state } from './gameState.js';
import { STARTER_LOADOUTS } from './data/items.js';

// Persistence
import { loadGame, setupAutoSave } from './persistence.js';

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
  // Crossed swords
  ctx.font = 'bold 28px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8a7a52';
  ctx.fillText('\u2694', w / 2 - 155, h / 2);
  ctx.fillText('\u2694', w / 2 + 155, h / 2);
  // Glow text
  ctx.font = 'bold 48px "Cinzel"';
  ctx.shadowColor = 'rgba(200,168,72,0.4)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#c8a848';
  ctx.fillText('PIXEL ARENA', w / 2, h / 2);
  // Bright inner text
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#d8b858';
  ctx.fillText('PIXEL ARENA', w / 2, h / 2);
  // Decorative line
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
  }
}

function dismissStartScreen() {
  document.getElementById('startScreen').style.display = 'none';
  document.querySelector('.app').style.display = '';
  if (document.getElementById('skipStartCheck').checked) {
    localStorage.setItem('pixel-arena-skip-start', '1');
  }
}
window.dismissStartScreen = dismissStartScreen;

initStartScreen();

// =============== INITIALIZATION ===============
state.canvas = document.getElementById('arenaCanvas');
state.ctx = state.canvas.getContext('2d');

// Set default showWin handler (arena's version handles wager transfers)
state._showWinFn = showWin;

// Load saved game data (collections, preferences, custom char)
var loaded = loadGame();

// Force single-player custom character
state.p1Class = 'custom';

// On first load: show archetype picker
if (!loaded) {
  document.getElementById('archetypeOverlay').style.display = 'flex';
}

// Build initial UI — default mode is dungeon
buildDungeonPicker();
updateFollowerDisplays();

function pickArchetype(arch) {
  var loadout = STARTER_LOADOUTS[arch];
  if (!loadout) return;
  state.customChar.equipment = Object.assign({}, loadout.equipment);
  state.customChar.sprite = loadout.sprite;
  state.customChar.skills = [loadout.skills[0], loadout.skills[1]];
  state.customChar.ultimate = loadout.ultimate;
  state.customChar.name = loadout.name;
  document.getElementById('archetypeOverlay').style.display = 'none';
  buildDungeonPicker();
}
window.pickArchetype = pickArchetype;

function showArchetypePicker() {
  document.getElementById('archetypeOverlay').style.display = 'flex';
}
window.showArchetypePicker = showArchetypePicker;

function resetGame() {
  if (confirm('Reset all progress? This deletes your gear, followers, and stats.')) {
    state._resetting = true;
    localStorage.removeItem('pixel-arena-save');
    location.reload();
  }
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
