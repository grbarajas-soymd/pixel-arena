// =============== API CLIENT ===============
// Connects to the Pixel Arena server on Railway.
// Change API_BASE to your Railway deployment URL.

var API_BASE = 'http://localhost:3001';

// ---- Token management ----

function getToken() {
  return localStorage.getItem('pa-token');
}

function setToken(token) {
  localStorage.setItem('pa-token', token);
}

function clearToken() {
  localStorage.removeItem('pa-token');
}

function getUsername() {
  return localStorage.getItem('pa-username');
}

function setUsername(name) {
  localStorage.setItem('pa-username', name);
}

function clearUsername() {
  localStorage.removeItem('pa-username');
}

function isLoggedIn() {
  return !!getToken();
}

// ---- Fetch helper ----

async function apiFetch(path, options) {
  var opts = options || {};
  var headers = opts.headers || {};
  headers['Content-Type'] = 'application/json';

  var token = getToken();
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  var resp = await fetch(API_BASE + path, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });

  var data = await resp.json();

  if (!resp.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// ---- Auth API ----

async function signup(username, password) {
  var data = await apiFetch('/api/auth/signup', {
    method: 'POST',
    body: { username: username, password: password }
  });
  setToken(data.token);
  setUsername(data.username);
  return data;
}

async function login(username, password) {
  var data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { username: username, password: password }
  });
  setToken(data.token);
  setUsername(data.username);
  return data;
}

function logout() {
  clearToken();
  clearUsername();
}

async function getMe() {
  return apiFetch('/api/auth/me');
}

// ---- Cloud Save API ----

async function loadCloudSave() {
  return apiFetch('/api/saves');
}

async function uploadCloudSave(saveData) {
  return apiFetch('/api/saves', {
    method: 'PUT',
    body: { save: saveData }
  });
}

async function deleteCloudSave() {
  return apiFetch('/api/saves', { method: 'DELETE' });
}

// ---- Leaderboard API ----

async function getLeaderboard() {
  return apiFetch('/api/leaderboard');
}

// Export for use in other scripts
window.PA_API = {
  API_BASE: API_BASE,
  isLoggedIn: isLoggedIn,
  getToken: getToken,
  getUsername: getUsername,
  signup: signup,
  login: login,
  logout: logout,
  getMe: getMe,
  loadCloudSave: loadCloudSave,
  uploadCloudSave: uploadCloudSave,
  deleteCloudSave: deleteCloudSave,
  getLeaderboard: getLeaderboard
};
