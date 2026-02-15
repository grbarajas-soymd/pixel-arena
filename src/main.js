// =============== MAIN ENTRY POINT ===============
// Vite entry: imports all modules, initializes game, sets up window exports.

import './styles.css';
import { state } from './gameState.js';

// Persistence
import { loadGame, setupAutoSave } from './persistence.js';

// Mode modules
import {
  buildSelector, launchBattle, backToSelect, startBattle, resetBattle,
  showWin, setSpd, toggleSound, cycleBiome, switchMode, setDungeonPlayer
} from './modes/arena.js';
import { setLadderPlayer, startLadder, ladderContinue, ladderQuit } from './modes/ladder.js';
import {
  startDungeon, abandonDungeon, buildDungeonPicker,
  dgKeepFollower, dgSellFollower, dgUsePotion, dgFlee,
  dgTakeTreasure, dgTriggerTrap, dgDodgeTrap, dgRest, dgSkipRest,
  dgUseShrine, dgBuyItem, dgCombatRound, dgClassMove,
  generateRoom, dgProceedToCapture, endDungeonRun, dgVictory,
  _dgActualGenerateRoom
} from './modes/dungeon.js';

// Custom character editor
import {
  saveCustomAndBack, cancelCustom, openSkillPicker, closeDD,
  updateStat, openCustomEditor
} from './custom.js';

// Render
import { render } from './render/arena.js';
import { updateFollowerDisplays, updateStakeUI } from './render/ui.js';

// =============== INITIALIZATION ===============
state.canvas = document.getElementById('arenaCanvas');
state.ctx = state.canvas.getContext('2d');

// Set default showWin handler (arena's version handles wager transfers)
state._showWinFn = showWin;

// Load saved game data (collections, preferences, custom char)
loadGame();

// Build initial UI
buildSelector();
updateFollowerDisplays();

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
window.updateStat = updateStat;
window.setDungeonPlayer = setDungeonPlayer;
window.startDungeon = startDungeon;
window.abandonDungeon = abandonDungeon;
window.setLadderPlayer = setLadderPlayer;
window.startLadder = startLadder;
window.ladderContinue = ladderContinue;
window.ladderQuit = ladderQuit;
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
window.dgCombatRound = dgCombatRound;
window.dgClassMove = dgClassMove;
window.generateRoom = generateRoom;
window.dgProceedToCapture = dgProceedToCapture;
window.endDungeonRun = endDungeonRun;
window.dgVictory = dgVictory;
window._dgActualGenerateRoom = _dgActualGenerateRoom;
