// =============== NETWORK LAYER ===============
var API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

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
