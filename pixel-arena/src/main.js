// =============== MAIN ENTRY POINT ===============
// Vite entry: imports all modules, initializes game, sets up window exports.

import './styles.css';
import { state } from './gameState.js';
import { STARTER_LOADOUTS } from './data/items.js';

// Persistence
import {
  loadSaveWrapper, loadCharacterSlot, createCharacterSlot,
  deleteCharacterSlot, getSaveData, saveGame, setupAutoSave, showSaveToast,
  cloudSaveUpload, cloudSaveDownload
} from './persistence.js';

// Network (auth)
import * as network from './network.js';

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
  _dgActualGenerateRoom, dgEquipGearDrop, dgStashGearDrop, dgSalvageGearDrop, dgBuyGear,
  dgDeployFollower, showCombatLogPopup, closeCombatLogPopup
} from './modes/dungeon.js';

// Custom character editor
import {
  saveCustomAndBack, cancelCustom, openSkillPicker, closeDD,
  openCustomEditor, applyClassDefaults
} from './custom.js';

// Render
import { openLeaderboard, closeLB } from './ui/leaderboard.js';
import { render } from './render/arena.js';
import { updateFollowerDisplays, updateStakeUI } from './render/ui.js';
import { drawSpritePreview } from './render/sprites.js';

// Tooltip system
import './tooltip.js';

// =============== ERROR CAPTURE ===============
window._recentErrors = [];
window.onerror = function(msg, src, line, col, err) {
  window._recentErrors.push({ msg: String(msg), src: src, line: line, col: col, stack: err && err.stack, at: Date.now() });
  if (window._recentErrors.length > 10) window._recentErrors.shift();
};
window.onunhandledrejection = function(e) {
  window._recentErrors.push({ msg: String(e.reason), stack: e.reason && e.reason.stack, at: Date.now() });
  if (window._recentErrors.length > 10) window._recentErrors.shift();
};

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
  ctx.fillText('\u2694', w / 2 - 220, h / 2);
  ctx.fillText('\u2694', w / 2 + 220, h / 2);
  ctx.font = 'bold 34px "Cinzel"';
  ctx.shadowColor = 'rgba(200,168,72,0.4)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#c8a848';
  ctx.fillText('SOME OF YOU MAY DIE', w / 2, h / 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#d8b858';
  ctx.fillText('SOME OF YOU MAY DIE', w / 2, h / 2);
  ctx.strokeStyle = 'rgba(200,168,72,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 190, h / 2 + 24);
  ctx.lineTo(w / 2 + 190, h / 2 + 24);
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
  if (localStorage.getItem('pixel-arena-tutorial-seen') !== '1') {
    showTutorial(initCharacterFlow);
  } else {
    initCharacterFlow();
  }
}
window.dismissStartScreen = dismissStartScreen;

// =============== TUTORIAL ===============

var TUTORIAL_SLIDES = [
  { icon: '\u{1F3F0}', title: 'DELVE THE DEPTHS', desc: 'Descend through dungeon floors. Fight monsters. Survive.' },
  { icon: '\u2694\uFE0F\u{1F43E}', title: 'CLAIM YOUR SPOILS', desc: 'Collect powerful gear and capture followers.' },
  { icon: '\u{1F3C6}', title: 'CLIMB THE LADDER', desc: 'Test your build against endless challengers.' },
  { icon: '\u{1F310}', title: 'CONQUER THE ARENA', desc: 'Upload your hero and battle real players online.' }
];

function showTutorial(onComplete) {
  var currentSlide = 0;
  var timer = null;
  var barAnim = null;

  var overlay = document.createElement('div');
  overlay.id = 'tutorialOverlay';
  overlay.className = 'tut-overlay';

  var slideEl = document.createElement('div');
  slideEl.className = 'tut-slide';
  overlay.appendChild(slideEl);

  var progressWrap = document.createElement('div');
  progressWrap.className = 'tut-progress';
  var dotsEl = document.createElement('div');
  dotsEl.className = 'tut-dots';
  var barOuter = document.createElement('div');
  barOuter.className = 'tut-bar';
  var barFill = document.createElement('div');
  barFill.className = 'tut-bar-fill';
  barOuter.appendChild(barFill);
  progressWrap.appendChild(dotsEl);
  progressWrap.appendChild(barOuter);
  overlay.appendChild(progressWrap);

  var skipBtn = document.createElement('button');
  skipBtn.className = 'tut-skip';
  skipBtn.textContent = 'SKIP \u2192';
  skipBtn.onclick = finish;
  overlay.appendChild(skipBtn);

  overlay.addEventListener('click', function(ev) {
    if (ev.target === overlay || ev.target === slideEl) advance();
  });

  document.body.appendChild(overlay);
  requestAnimationFrame(function() { overlay.classList.add('show'); });

  function renderSlide(idx) {
    var s = TUTORIAL_SLIDES[idx];
    slideEl.style.opacity = '0';
    setTimeout(function() {
      slideEl.innerHTML =
        '<div class="tut-icon">' + s.icon + '</div>' +
        '<div class="tut-title">' + s.title + '</div>' +
        '<div class="tut-desc">' + s.desc + '</div>';
      slideEl.style.opacity = '1';
    }, 300);

    var dots = '';
    for (var i = 0; i < TUTORIAL_SLIDES.length; i++) {
      dots += '<span class="tut-dot' + (i === idx ? ' active' : '') + '">\u25CF</span> ';
    }
    dotsEl.innerHTML = dots;

    barFill.style.transition = 'none';
    barFill.style.width = '0%';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        barFill.style.transition = 'width 3s linear';
        barFill.style.width = '100%';
      });
    });
  }

  function advance() {
    clearTimeout(timer);
    currentSlide++;
    if (currentSlide >= TUTORIAL_SLIDES.length) {
      finish();
    } else {
      renderSlide(currentSlide);
      timer = setTimeout(advance, 3000);
    }
  }

  function finish() {
    clearTimeout(timer);
    localStorage.setItem('pixel-arena-tutorial-seen', '1');
    overlay.classList.remove('show');
    setTimeout(function() {
      overlay.remove();
      onComplete();
    }, 400);
  }

  renderSlide(0);
  timer = setTimeout(advance, 3000);
}

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

  // Footer: Account + Cloud Save section
  buildAccountSection(footer);

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

// =============== ACCOUNT & CLOUD SAVE ===============

function buildAccountSection(container) {
  var section = document.createElement('div');
  section.className = 'account-section';
  section.style.cssText = 'margin-top:12px;padding:10px;border-top:1px solid rgba(200,168,72,0.2);text-align:center;font-size:.42rem';

  if (network.isLoggedIn()) {
    network.getMe().then(function(user) {
      section.innerHTML =
        '<div style="color:var(--gold);margin-bottom:6px">\u2601 Cloud Account: <b>' + user.username + '</b></div>' +
        '<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">' +
          '<button class="btn btn-spd" style="font-size:.38rem;padding:3px 10px" onclick="cloudUpload()">\u2B06 Upload Save</button>' +
          '<button class="btn btn-spd" style="font-size:.38rem;padding:3px 10px" onclick="cloudDownload()">\u2B07 Download Save</button>' +
          '<button class="btn btn-back" style="font-size:.38rem;padding:3px 10px;opacity:0.7" onclick="accountLogout()">Logout</button>' +
        '</div>' +
        '<div id="cloudStatus" style="margin-top:4px;color:var(--parch-dk);font-size:.38rem"></div>';
    }).catch(function() {
      // Token expired/invalid
      network.logout();
      buildAccountLoginForm(section);
    });
  } else {
    buildAccountLoginForm(section);
  }

  container.appendChild(section);
}

function buildAccountLoginForm(section) {
  section.innerHTML =
    '<div style="color:var(--parch-dk);margin-bottom:6px">\u2601 Cloud saves let you sync progress across devices</div>' +
    '<div id="authForm">' +
      '<input id="authUser" class="cs-name-input" placeholder="Username" maxlength="20" style="width:110px;display:inline-block;margin-right:4px;font-size:.38rem">' +
      '<input id="authPass" type="password" class="cs-name-input" placeholder="Password" style="width:110px;display:inline-block;margin-right:4px;font-size:.38rem">' +
      '<button class="btn btn-spd" style="font-size:.38rem;padding:3px 8px" onclick="accountLogin()">Login</button>' +
      '<button class="btn btn-spd" style="font-size:.38rem;padding:3px 8px" onclick="accountSignup()">Sign Up</button>' +
    '</div>' +
    '<div id="cloudStatus" style="margin-top:4px;color:var(--parch-dk);font-size:.38rem"></div>';
}

function setCloudStatus(msg, isError) {
  var el = document.getElementById('cloudStatus');
  if (el) {
    el.textContent = msg;
    el.style.color = isError ? '#aa5a5a' : '#6a9a6a';
  }
}

function accountLogin() {
  var user = (document.getElementById('authUser') || {}).value || '';
  var pass = (document.getElementById('authPass') || {}).value || '';
  if (!user || !pass) { setCloudStatus('Enter username and password', true); return; }
  setCloudStatus('Logging in...');
  network.login(user, pass).then(function() {
    showCharacterSelect();
  }).catch(function(e) {
    setCloudStatus(e.message || 'Login failed', true);
  });
}
window.accountLogin = accountLogin;

function accountSignup() {
  var user = (document.getElementById('authUser') || {}).value || '';
  var pass = (document.getElementById('authPass') || {}).value || '';
  if (!user || user.length < 3) { setCloudStatus('Username must be 3-20 characters', true); return; }
  if (!pass || pass.length < 6) { setCloudStatus('Password must be at least 6 characters', true); return; }
  setCloudStatus('Creating account...');
  network.signup(user, pass).then(function() {
    setCloudStatus('Account created! Uploading save...');
    return cloudSaveUpload();
  }).then(function() {
    showCharacterSelect();
  }).catch(function(e) {
    setCloudStatus(e.message || 'Signup failed', true);
  });
}
window.accountSignup = accountSignup;

function accountLogout() {
  network.logout();
  showCharacterSelect();
}
window.accountLogout = accountLogout;

function showAuthOverlay() {
  showCharacterSelect();
}
window.showAuthOverlay = showAuthOverlay;

function cloudUpload() {
  saveGame();
  setCloudStatus('Uploading...');
  cloudSaveUpload().then(function() {
    setCloudStatus('Save uploaded to cloud!');
  }).catch(function(e) {
    setCloudStatus(e.message || 'Upload failed', true);
  });
}
window.cloudUpload = cloudUpload;

function cloudDownload() {
  if (!confirm('Download cloud save? This will replace your local save data.')) return;
  setCloudStatus('Downloading...');
  cloudSaveDownload().then(function(wrapper) {
    if (!wrapper) { setCloudStatus('No cloud save found', true); return; }
    setCloudStatus('Save downloaded! Reloading...');
    setTimeout(function() { location.reload(); }, 500);
  }).catch(function(e) {
    setCloudStatus(e.message || 'Download failed', true);
  });
}
window.cloudDownload = cloudDownload;

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
window.dgSalvageGearDrop = dgSalvageGearDrop;
window.dgDeployFollower = dgDeployFollower;
window.showCombatLogPopup = showCombatLogPopup;
window.closeCombatLogPopup = closeCombatLogPopup;
window.registerPlayer = registerPlayer;
window.uploadBuild = uploadBuild;
window.refreshOpponents = refreshOpponents;
window.openLeaderboard = openLeaderboard;
window.closeLB = closeLB;

// =============== BUG REPORT ===============
function openBugReport() {
  var overlay = document.getElementById('bugReportOverlay');
  if (!overlay) {
    // Create the bug report modal
    overlay = document.createElement('div');
    overlay.id = 'bugReportOverlay';
    overlay.className = 'dropdown-overlay show';
    overlay.innerHTML =
      '<div class="dropdown-panel" style="max-width:400px">' +
        '<div class="dd-title">Report a Bug</div>' +
        '<div style="margin-bottom:8px">' +
          '<label style="font-size:.52rem;color:var(--text-dim);display:block;margin-bottom:2px">Category</label>' +
          '<select id="bugCategory" style="width:100%;font-family:Cinzel,serif;font-size:.52rem;background:rgba(0,0,0,0.5);border:1px solid var(--panel-border);color:var(--gold-bright);padding:6px 8px">' +
            '<option value="gameplay">Gameplay</option>' +
            '<option value="ui">UI</option>' +
            '<option value="crash">Crash</option>' +
            '<option value="balance">Balance</option>' +
            '<option value="network">Network</option>' +
            '<option value="other">Other</option>' +
          '</select>' +
        '</div>' +
        '<div style="margin-bottom:8px">' +
          '<label style="font-size:.52rem;color:var(--text-dim);display:block;margin-bottom:2px">Description (min 10 chars)</label>' +
          '<textarea id="bugDescription" rows="4" style="width:100%;font-family:Cinzel,serif;font-size:.52rem;background:rgba(0,0,0,0.5);border:1px solid var(--panel-border);color:var(--text);padding:6px 8px;resize:vertical" placeholder="Describe what happened..."></textarea>' +
        '</div>' +
        '<div style="margin-bottom:10px">' +
          '<label style="font-size:.52rem;color:var(--text-dim);cursor:pointer;display:flex;align-items:center;gap:4px">' +
            '<input type="checkbox" id="bugScreenshot"> Include screenshot' +
          '</label>' +
        '</div>' +
        '<div id="bugStatus" style="font-size:.52rem;margin-bottom:6px;min-height:16px"></div>' +
        '<div style="display:flex;gap:8px;justify-content:center">' +
          '<button class="dd-close" onclick="submitBug()" style="background:linear-gradient(180deg,#1e1408,#120c04);border-color:var(--gold);color:var(--gold-bright)">Submit</button>' +
          '<button class="dd-close" onclick="closeBugReport()">Cancel</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
  } else {
    overlay.classList.add('show');
    overlay.style.display = 'flex';
  }
  document.getElementById('bugDescription').value = '';
  document.getElementById('bugStatus').textContent = '';
  document.getElementById('bugScreenshot').checked = false;
}
window.openBugReport = openBugReport;

function closeBugReport() {
  var overlay = document.getElementById('bugReportOverlay');
  if (overlay) {
    overlay.classList.remove('show');
    overlay.style.display = 'none';
  }
}
window.closeBugReport = closeBugReport;

function submitBug() {
  var cat = document.getElementById('bugCategory').value;
  var desc = document.getElementById('bugDescription').value;
  var statusEl = document.getElementById('bugStatus');

  if (!desc || desc.trim().length < 10) {
    statusEl.style.color = '#aa5a5a';
    statusEl.textContent = 'Description must be at least 10 characters.';
    return;
  }

  statusEl.style.color = 'var(--gold)';
  statusEl.textContent = 'Submitting...';

  var screenshotData = null;
  if (document.getElementById('bugScreenshot').checked && state.canvas) {
    try { screenshotData = state.canvas.toDataURL('image/png'); } catch(e) {}
  }

  network.submitBugReport(cat, desc.trim(), screenshotData).then(function(r) {
    if (r.ok) {
      statusEl.style.color = '#5a9a5a';
      statusEl.textContent = 'Bug report submitted! (#' + r.id + ')';
      setTimeout(closeBugReport, 1500);
    } else {
      statusEl.style.color = '#aa5a5a';
      statusEl.textContent = r.error || 'Failed to submit.';
    }
  }).catch(function() {
    statusEl.style.color = '#aa5a5a';
    statusEl.textContent = 'Network error. Try again.';
  });
}
window.submitBug = submitBug;
