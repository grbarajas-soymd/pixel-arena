// =============== LEADERBOARD UI ===============
import { state } from '../gameState.js';
import { fetchLeaderboard } from '../network.js';

var _activeTab = 'arena';
var _cache = null;

export function openLeaderboard() {
  var overlay = document.getElementById('lbOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  _activeTab = 'arena';
  _renderTabs();
  _fetchAndRender();
}

export function closeLB() {
  var overlay = document.getElementById('lbOverlay');
  if (overlay) overlay.style.display = 'none';
}

function _renderTabs() {
  var tabs = document.getElementById('lbTabs');
  if (!tabs) return;
  var modes = [
    { key: 'arena', label: 'Arena' },
    { key: 'ladder', label: 'Ladder' },
    { key: 'dungeon', label: 'Dungeon' },
  ];
  tabs.innerHTML = '';
  modes.forEach(function (m) {
    var btn = document.createElement('button');
    btn.className = 'lb-tab' + (m.key === _activeTab ? ' active' : '');
    btn.textContent = m.key === 'arena' ? '\u2694 ' + m.label : m.key === 'ladder' ? '\u{1F3C6} ' + m.label : '\u{1F3D4}\uFE0F ' + m.label;
    btn.onclick = function () {
      _activeTab = m.key;
      _renderTabs();
      _renderTable();
    };
    tabs.appendChild(btn);
  });
}

function _fetchAndRender() {
  var content = document.getElementById('lbContent');
  if (content) content.innerHTML = '<div style="text-align:center;color:var(--parch-dk);padding:20px">Loading...</div>';
  fetchLeaderboard().then(function (data) {
    _cache = data;
    _renderTable();
  }).catch(function () {
    if (content) content.innerHTML = '<div style="text-align:center;color:#aa5a5a;padding:20px">Could not load leaderboard. Is the server running?</div>';
  });
}

function _renderTable() {
  var content = document.getElementById('lbContent');
  if (!content || !_cache) return;
  var list = _cache[_activeTab] || [];
  if (list.length === 0) {
    content.innerHTML = '<div style="text-align:center;color:var(--parch-dk);padding:20px">No entries yet.</div>';
    return;
  }
  var html = '<table class="lb-table"><thead><tr><th>#</th><th>Name</th>';
  if (_activeTab === 'arena') html += '<th>Wins</th><th>Losses</th><th>Win%</th>';
  else if (_activeTab === 'ladder') html += '<th>Best Streak</th>';
  else html += '<th>Clears</th>';
  html += '</tr></thead><tbody>';
  list.forEach(function (entry, i) {
    var rank = i + 1;
    var isMe = state.playerId && entry.playerId === state.playerId;
    var rankClass = rank <= 3 ? ' lb-top' + rank : '';
    var rowClass = isMe ? ' lb-me' : '';
    html += '<tr class="' + rowClass + '"><td class="lb-rank' + rankClass + '">' + rank + '</td>';
    html += '<td class="lb-name">' + _esc(entry.playerName) + (isMe ? ' <span style="color:var(--gold-bright);font-size:.42rem">(you)</span>' : '') + '</td>';
    if (_activeTab === 'arena') {
      html += '<td>' + entry.wins + '</td><td>' + entry.losses + '</td><td>' + entry.winRate + '%</td>';
    } else if (_activeTab === 'ladder') {
      html += '<td>' + entry.ladderBest + 'W</td>';
    } else {
      html += '<td>' + entry.dungeonClears + '</td>';
    }
    html += '</tr>';
  });
  html += '</tbody></table>';
  content.innerHTML = html;
}

function _esc(s) {
  var d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
