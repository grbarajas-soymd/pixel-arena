// =============== NETWORK LAYER ===============
import { state } from './gameState.js';

var API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
var TOKEN_KEY = 'pixel-arena-auth-token';

// ---- Token management ----

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn() {
  return !!getToken();
}

function authHeaders() {
  var token = getToken();
  var h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

// ---- Auth API ----

export function signup(username, password) {
  return fetch(API_BASE + '/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, password: password })
  }).then(function (r) {
    if (!r.ok) return r.json().then(function (e) { throw new Error(e.error); });
    return r.json();
  }).then(function (data) {
    setToken(data.token);
    return data;
  });
}

export function login(username, password) {
  return fetch(API_BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, password: password })
  }).then(function (r) {
    if (!r.ok) return r.json().then(function (e) { throw new Error(e.error); });
    return r.json();
  }).then(function (data) {
    setToken(data.token);
    return data;
  });
}

export function logout() {
  setToken(null);
}

export function getMe() {
  return fetch(API_BASE + '/api/auth/me', {
    headers: authHeaders()
  }).then(function (r) {
    if (!r.ok) { setToken(null); throw new Error('Not logged in'); }
    return r.json();
  });
}

// ---- Cloud save API ----

export function fetchCloudSave() {
  return fetch(API_BASE + '/api/saves', {
    headers: authHeaders()
  }).then(function (r) {
    if (r.status === 404) return null;
    if (!r.ok) return r.json().then(function (e) { throw new Error(e.error); });
    return r.json();
  });
}

export function uploadCloudSave(saveData) {
  return fetch(API_BASE + '/api/saves', {
    method: 'PUT', headers: authHeaders(),
    body: JSON.stringify({ save: saveData })
  }).then(function (r) {
    if (!r.ok) return r.json().then(function (e) { throw new Error(e.error); });
    return r.json();
  });
}

export function deleteCloudSave() {
  return fetch(API_BASE + '/api/saves', {
    method: 'DELETE', headers: authHeaders()
  }).then(function (r) { return r.json(); });
}

// ---- Arena API ----

export function register(name) {
  return fetch(API_BASE + '/api/register', {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ name: name })
  }).then(function (r) {
    if (!r.ok) return r.json().then(function (e) { throw new Error(e.error); });
    return r.json();
  });
}

export function uploadBuild(playerId, character) {
  return fetch(API_BASE + '/api/characters', {
    method: 'PUT', headers: authHeaders(),
    body: JSON.stringify(character)
  }).then(function (r) {
    if (!r.ok) return r.json().then(function (e) { throw new Error(e.error); });
    return r.json();
  });
}

export function fetchOpponents(excludeId) {
  return fetch(API_BASE + '/api/characters?exclude=' + encodeURIComponent(excludeId || ''))
    .then(function (r) { return r.json(); });
}

export function fetchBuild(playerId) {
  return fetch(API_BASE + '/api/characters/' + encodeURIComponent(playerId))
    .then(function (r) { return r.json(); });
}

export function startBattle(defenderId) {
  return fetch(API_BASE + '/api/battles/start', {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ defenderId: defenderId })
  }).then(function (r) {
    if (!r.ok) return r.json().then(function (e) { throw new Error(e.error); });
    return r.json();
  });
}

export function reportBattle(battleToken, challengerWon) {
  return fetch(API_BASE + '/api/battles', {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ battleToken: battleToken, challengerWon: challengerWon })
  }).then(function (r) {
    if (!r.ok) return r.json().then(function (e) { throw new Error(e.error); });
    return r.json();
  });
}

export function uploadStats(ladderBest, dungeonClears) {
  return fetch(API_BASE + '/api/stats', {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ ladderBest: ladderBest, dungeonClears: dungeonClears })
  }).then(function (r) { return r.json(); }).catch(function () {});
}

export function fetchLeaderboard() {
  return fetch(API_BASE + '/api/leaderboard')
    .then(function (r) { return r.json(); });
}

// ---- Bug Reports ----

function gatherDiagnostics() {
  var diag = {};

  // Current screen detection
  var screens = ['selectorScreen', 'battleScreen', 'customScreen', 'dungeonScreen', 'ladderScreen'];
  diag.current_screen = 'unknown';
  for (var i = 0; i < screens.length; i++) {
    var el = document.getElementById(screens[i]);
    if (el && el.style.display !== 'none' && el.style.display !== '') {
      diag.current_screen = screens[i].replace('Screen', '');
      break;
    }
  }

  // Character build
  if (state.customChar) {
    var cc = state.customChar;
    diag.character_build = {
      name: cc.name,
      sprite: cc.sprite,
      skills: cc.skills,
      ultimate: cc.ultimate,
      baseStats: cc.baseStats,
      equipment: {}
    };
    if (cc.equipment) {
      for (var slot in cc.equipment) {
        var item = cc.equipment[slot];
        if (item) {
          diag.character_build.equipment[slot] = typeof item === 'string' ? item : { baseKey: item.baseKey, id: item.id };
        }
      }
    }
  }

  // Game mode state
  diag.game_mode_state = {};
  if (state.dgRun) {
    diag.game_mode_state.dungeon_floor = state.dgRun.floor;
    diag.game_mode_state.dungeon_room = state.dgRun.room;
    diag.game_mode_state.dungeon_hp = state.dgRun.hp;
  }
  if (state.ladderRun) {
    diag.game_mode_state.ladder_wins = state.ladderRun.wins;
  }
  diag.game_mode_state.ladder_best = state.ladderBest || 0;
  diag.game_mode_state.dungeon_clears = state.dungeonClears || 0;

  // Combat log (last 20)
  if (state.logs && state.logs.length) {
    diag.combat_log = state.logs.slice(-20);
  }

  // Recent JS errors
  if (window._recentErrors && window._recentErrors.length) {
    diag.recent_errors = window._recentErrors.slice();
  }

  // Misc state
  diag.save_slot = state._activeSlotIndex;
  diag.dust = state.dust || 0;
  diag.follower_count = state.p1Collection ? state.p1Collection.length : 0;
  diag.gear_bag_count = state.gearBag ? state.gearBag.length : 0;

  // Device info
  diag.device = {
    user_agent: navigator.userAgent,
    screen: screen.width + 'x' + screen.height,
    is_mobile: state.isMobile || false,
    viewport: window.innerWidth + 'x' + window.innerHeight
  };

  return diag;
}

export function submitBugReport(category, description, screenshotData) {
  var diag = gatherDiagnostics();
  return fetch(API_BASE + '/api/bugs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: category,
      description: description,
      diagnostic_data: JSON.stringify(diag),
      screenshot_data: screenshotData || null,
      player_id: state.playerId || null,
      player_name: state.playerName || null
    })
  }).then(function (r) { return r.json(); });
}
