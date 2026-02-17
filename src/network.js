// =============== NETWORK LAYER ===============
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
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name })
  }).then(function (r) { return r.json(); });
}

export function uploadBuild(playerId, character) {
  return fetch(API_BASE + '/api/characters', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Player-Id': playerId },
    body: JSON.stringify(character)
  }).then(function (r) { return r.json(); });
}

export function fetchOpponents(excludeId) {
  return fetch(API_BASE + '/api/characters?exclude=' + encodeURIComponent(excludeId || ''))
    .then(function (r) { return r.json(); });
}

export function fetchBuild(playerId) {
  return fetch(API_BASE + '/api/characters/' + encodeURIComponent(playerId))
    .then(function (r) { return r.json(); });
}

export function reportBattle(challengerId, defenderId, challengerWon) {
  return fetch(API_BASE + '/api/battles', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengerId: challengerId, defenderId: defenderId, challengerWon: challengerWon })
  }).then(function (r) { return r.json(); });
}

export function uploadStats(playerId, ladderBest, dungeonClears) {
  return fetch(API_BASE + '/api/stats', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Player-Id': playerId },
    body: JSON.stringify({ ladderBest: ladderBest, dungeonClears: dungeonClears })
  }).then(function (r) { return r.json(); }).catch(function () {});
}

export function fetchLeaderboard() {
  return fetch(API_BASE + '/api/leaderboard')
    .then(function (r) { return r.json(); });
}
