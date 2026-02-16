// =============== SOME OF YOU MAY DIE — EXPRESS API ===============
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var DATA_DIR = path.join(__dirname, 'data');
var DB_FILE = path.join(DATA_DIR, 'characters.json');
var PORT = process.env.PORT || 3001;
var ADMIN_KEY = process.env.ADMIN_KEY || 'admin';

// Ensure data directory + file exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ players: {} }));

function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); }
  catch (e) { return { players: {} }; }
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function checkAdmin(req, res) {
  var key = req.headers['x-admin-key'] || req.query.key;
  if (key !== ADMIN_KEY) { res.status(403).json({ error: 'Invalid admin key' }); return false; }
  return true;
}

var app = express();
app.use(cors());
app.use(express.json());

// ---- PUBLIC API ROUTES ----

// POST /api/register — create player identity
app.post('/api/register', function (req, res) {
  var name = (req.body.name || '').trim();
  if (!name || name.length > 20) return res.status(400).json({ error: 'Name required (max 20 chars)' });
  var playerId = crypto.randomUUID();
  var db = readDB();
  db.players[playerId] = { playerName: name, character: null, record: { wins: 0, losses: 0 }, ladderBest: 0, dungeonClears: 0, uploadedAt: null };
  writeDB(db);
  res.json({ playerId: playerId });
});

// PUT /api/characters — upload/update build
app.put('/api/characters', function (req, res) {
  var playerId = req.headers['x-player-id'];
  if (!playerId) return res.status(401).json({ error: 'Missing X-Player-Id header' });
  var db = readDB();
  if (!db.players[playerId]) return res.status(404).json({ error: 'Player not found' });
  db.players[playerId].character = req.body;
  db.players[playerId].uploadedAt = new Date().toISOString();
  writeDB(db);
  res.json({ ok: true });
});

// GET /api/characters — list all opponents (exclude self)
app.get('/api/characters', function (req, res) {
  var exclude = req.query.exclude || '';
  var db = readDB();
  var list = [];
  for (var id in db.players) {
    if (id === exclude) continue;
    var p = db.players[id];
    if (!p.character) continue;
    list.push({ playerId: id, playerName: p.playerName, character: p.character, record: p.record, uploadedAt: p.uploadedAt });
  }
  res.json(list);
});

// GET /api/characters/:playerId — single player build
app.get('/api/characters/:playerId', function (req, res) {
  var db = readDB();
  var p = db.players[req.params.playerId];
  if (!p || !p.character) return res.status(404).json({ error: 'Build not found' });
  res.json({ playerId: req.params.playerId, playerName: p.playerName, character: p.character, record: p.record });
});

// POST /api/battles — report result
app.post('/api/battles', function (req, res) {
  var { challengerId, defenderId, challengerWon } = req.body;
  if (!challengerId || !defenderId) return res.status(400).json({ error: 'Missing IDs' });
  var db = readDB();
  if (db.players[challengerId]) {
    if (challengerWon) db.players[challengerId].record.wins++;
    else db.players[challengerId].record.losses++;
  }
  if (db.players[defenderId]) {
    if (challengerWon) db.players[defenderId].record.losses++;
    else db.players[defenderId].record.wins++;
  }
  writeDB(db);
  res.json({ ok: true });
});

// POST /api/stats — sync local stats to server (only accepts higher values)
app.post('/api/stats', function (req, res) {
  var playerId = req.headers['x-player-id'];
  if (!playerId) return res.status(401).json({ error: 'Missing X-Player-Id header' });
  var db = readDB();
  if (!db.players[playerId]) return res.status(404).json({ error: 'Player not found' });
  var p = db.players[playerId];
  var lb = req.body.ladderBest || 0;
  var dc = req.body.dungeonClears || 0;
  if (lb > (p.ladderBest || 0)) p.ladderBest = lb;
  if (dc > (p.dungeonClears || 0)) p.dungeonClears = dc;
  writeDB(db);
  res.json({ ok: true });
});

// GET /api/leaderboard — top 20 rankings for all modes
app.get('/api/leaderboard', function (req, res) {
  var db = readDB();
  var arena = [], ladder = [], dungeon = [];
  for (var id in db.players) {
    var p = db.players[id];
    var r = p.record || { wins: 0, losses: 0 };
    if (r.wins > 0 || r.losses > 0) {
      var total = r.wins + r.losses;
      arena.push({ playerId: id, playerName: p.playerName, wins: r.wins, losses: r.losses, winRate: total > 0 ? Math.round(r.wins / total * 100) : 0 });
    }
    if ((p.ladderBest || 0) > 0) {
      ladder.push({ playerId: id, playerName: p.playerName, ladderBest: p.ladderBest });
    }
    if ((p.dungeonClears || 0) > 0) {
      dungeon.push({ playerId: id, playerName: p.playerName, dungeonClears: p.dungeonClears });
    }
  }
  arena.sort(function (a, b) { return b.wins - a.wins; });
  ladder.sort(function (a, b) { return b.ladderBest - a.ladderBest; });
  dungeon.sort(function (a, b) { return b.dungeonClears - a.dungeonClears; });
  res.json({ arena: arena.slice(0, 20), ladder: ladder.slice(0, 20), dungeon: dungeon.slice(0, 20) });
});

// ---- ADMIN API ROUTES ----

// GET /api/admin/players — list all players with full details
app.get('/api/admin/players', function (req, res) {
  if (!checkAdmin(req, res)) return;
  var db = readDB();
  var list = [];
  for (var id in db.players) {
    var p = db.players[id];
    list.push({
      playerId: id,
      playerName: p.playerName,
      record: p.record,
      uploadedAt: p.uploadedAt,
      hasCharacter: !!p.character,
      character: p.character
    });
  }
  res.json({ total: list.length, players: list });
});

// DELETE /api/admin/players/:playerId — delete a player
app.delete('/api/admin/players/:playerId', function (req, res) {
  if (!checkAdmin(req, res)) return;
  var db = readDB();
  if (!db.players[req.params.playerId]) return res.status(404).json({ error: 'Player not found' });
  delete db.players[req.params.playerId];
  writeDB(db);
  res.json({ ok: true });
});

// POST /api/admin/reset-record/:playerId — reset a player's W/L record
app.post('/api/admin/reset-record/:playerId', function (req, res) {
  if (!checkAdmin(req, res)) return;
  var db = readDB();
  if (!db.players[req.params.playerId]) return res.status(404).json({ error: 'Player not found' });
  db.players[req.params.playerId].record = { wins: 0, losses: 0 };
  writeDB(db);
  res.json({ ok: true });
});

// DELETE /api/admin/all — wipe all players
app.delete('/api/admin/all', function (req, res) {
  if (!checkAdmin(req, res)) return;
  writeDB({ players: {} });
  res.json({ ok: true, message: 'All players deleted' });
});

// ---- ADMIN PAGE ----
app.get('/admin', function (req, res) {
  res.send(ADMIN_HTML);
});

var ADMIN_HTML = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin — Some of You May Die</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#1a1a2e;color:#e0e0e0;padding:20px;max-width:900px;margin:0 auto}
  h1{color:#c8a848;margin-bottom:4px;font-size:1.4rem}
  .sub{color:#888;margin-bottom:16px;font-size:.85rem}
  .login{background:#16213e;padding:20px;border-radius:8px;margin-bottom:16px}
  .login input{background:#0f3460;border:1px solid #444;color:#fff;padding:8px 12px;border-radius:4px;margin-right:8px;font-size:.9rem}
  .login button,.btn{background:#c8a848;color:#1a1a2e;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-weight:700;font-size:.85rem}
  .btn:hover{background:#d8b858}
  .btn-danger{background:#aa3a3a;color:#fff}
  .btn-danger:hover{background:#cc4444}
  .btn-sm{padding:4px 10px;font-size:.75rem}
  .stats{display:flex;gap:16px;margin-bottom:16px}
  .stat-card{background:#16213e;padding:12px 20px;border-radius:8px;text-align:center}
  .stat-num{font-size:1.8rem;font-weight:700;color:#c8a848}
  .stat-label{font-size:.75rem;color:#888}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:.85rem}
  th{text-align:left;padding:8px;border-bottom:2px solid #333;color:#c8a848;font-size:.75rem;text-transform:uppercase}
  td{padding:8px;border-bottom:1px solid #222}
  tr:hover{background:#16213e}
  .gear-list{font-size:.7rem;color:#888}
  .actions{display:flex;gap:4px}
  #content{display:none}
  .empty{color:#666;font-style:italic;padding:20px;text-align:center}
</style>
</head><body>
<h1>Admin Panel</h1>
<div class="sub">Some of You May Die — Arena Management</div>

<div class="login" id="loginBox">
  <input type="password" id="keyInput" placeholder="Admin key..." onkeydown="if(event.key==='Enter')doLogin()">
  <button onclick="doLogin()">Login</button>
</div>

<div id="content">
  <div class="stats">
    <div class="stat-card"><div class="stat-num" id="statTotal">0</div><div class="stat-label">Total Players</div></div>
    <div class="stat-card"><div class="stat-num" id="statBuilds">0</div><div class="stat-label">Uploaded Builds</div></div>
    <div class="stat-card"><div class="stat-num" id="statBattles">0</div><div class="stat-label">Total Battles</div></div>
  </div>
  <div style="display:flex;gap:8px;margin-bottom:12px">
    <button class="btn" onclick="refresh()">Refresh</button>
    <button class="btn btn-danger" onclick="wipeAll()">Wipe All Players</button>
  </div>
  <table>
    <thead><tr><th>Name</th><th>Build</th><th>Record</th><th>Uploaded</th><th>Actions</th></tr></thead>
    <tbody id="playerRows"></tbody>
  </table>
  <div class="empty" id="emptyMsg" style="display:none">No players registered yet.</div>
</div>

<script>
var adminKey='';
function doLogin(){
  adminKey=document.getElementById('keyInput').value;
  fetch('/api/admin/players?key='+encodeURIComponent(adminKey))
    .then(function(r){if(!r.ok)throw new Error();return r.json()})
    .then(function(){
      document.getElementById('loginBox').style.display='none';
      document.getElementById('content').style.display='block';
      refresh();
    })
    .catch(function(){alert('Invalid admin key')});
}
function api(method,path){
  return fetch(path,{method:method,headers:{'X-Admin-Key':adminKey}}).then(function(r){return r.json()});
}
function refresh(){
  api('GET','/api/admin/players').then(function(data){
    var players=data.players||[];
    document.getElementById('statTotal').textContent=data.total;
    document.getElementById('statBuilds').textContent=players.filter(function(p){return p.hasCharacter}).length;
    var totalBattles=0;
    players.forEach(function(p){totalBattles+=(p.record?p.record.wins+p.record.losses:0)});
    document.getElementById('statBattles').textContent=Math.floor(totalBattles/2);
    var tbody=document.getElementById('playerRows');
    tbody.innerHTML='';
    document.getElementById('emptyMsg').style.display=players.length?'none':'block';
    players.forEach(function(p){
      var tr=document.createElement('tr');
      var ch=p.character;
      var buildInfo=ch?ch.name+' ('+ch.sprite+')':'<span style="color:#666">—</span>';
      var gear='';
      if(ch&&ch.equipment){
        var slots=Object.values(ch.equipment).filter(Boolean);
        gear=slots.join(', ');
      }
      var rec=p.record?(p.record.wins+'W / '+p.record.losses+'L'):'0W / 0L';
      var ago=p.uploadedAt?timeAgo(p.uploadedAt):'never';
      tr.innerHTML='<td><b>'+p.playerName+'</b><div style="font-size:.65rem;color:#666">'+p.playerId.slice(0,8)+'...</div></td>'+
        '<td>'+buildInfo+(gear?'<div class="gear-list">'+gear+'</div>':'')+'</td>'+
        '<td>'+rec+'</td>'+
        '<td style="font-size:.75rem;color:#888">'+ago+'</td>'+
        '<td class="actions"></td>';
      var actions=tr.querySelector('.actions');
      var resetBtn=document.createElement('button');
      resetBtn.className='btn btn-sm';resetBtn.textContent='Reset W/L';
      resetBtn.onclick=function(){
        if(confirm('Reset '+p.playerName+'\\'s record?'))
          api('POST','/api/admin/reset-record/'+p.playerId).then(refresh);
      };
      var delBtn=document.createElement('button');
      delBtn.className='btn btn-sm btn-danger';delBtn.textContent='Delete';
      delBtn.onclick=function(){
        if(confirm('Delete '+p.playerName+'? This removes them from the arena.'))
          api('DELETE','/api/admin/players/'+p.playerId).then(refresh);
      };
      actions.appendChild(resetBtn);
      actions.appendChild(delBtn);
      tbody.appendChild(tr);
    });
  });
}
function wipeAll(){
  if(!confirm('Delete ALL players? This cannot be undone.'))return;
  if(!confirm('Are you sure? This wipes the entire arena database.'))return;
  api('DELETE','/api/admin/all').then(refresh);
}
function timeAgo(iso){
  var d=Date.now()-new Date(iso).getTime();
  var m=Math.floor(d/60000);
  if(m<1)return 'just now';if(m<60)return m+'m ago';
  var h=Math.floor(m/60);if(h<24)return h+'h ago';
  return Math.floor(h/24)+'d ago';
}
</script>
</body></html>`;

// ---- STATIC FILES (production) ----
var distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback: serve index.html for non-API routes
  app.get('*', function (req, res) {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, function () {
  console.log('Some of You May Die running on port ' + PORT);
});
