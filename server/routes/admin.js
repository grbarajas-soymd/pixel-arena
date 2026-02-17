// =============== ADMIN ROUTES ===============
import { Router } from 'express';
import { listAllPlayers, deletePlayer, resetRecord, wipeAllPlayers } from '../db.js';

var router = Router();

var ADMIN_KEY = process.env.ADMIN_KEY || 'admin';

function checkAdmin(req, res) {
  var key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) {
    res.status(403).json({ error: 'Invalid admin key' });
    return false;
  }
  return true;
}

// GET /api/admin/players
router.get('/players', function (req, res) {
  if (!checkAdmin(req, res)) return;
  var rows = listAllPlayers();
  var players = rows.map(function (r) {
    var ch = r.build_json ? JSON.parse(r.build_json) : null;
    return {
      playerId: r.playerId,
      playerName: r.playerName,
      record: { wins: r.wins || 0, losses: r.losses || 0 },
      uploadedAt: r.uploaded_at,
      hasCharacter: !!ch,
      character: ch,
      ladderBest: r.ladder_best || 0,
      dungeonClears: r.dungeon_clears || 0
    };
  });
  res.json({ total: players.length, players: players });
});

// DELETE /api/admin/players/:playerId
router.delete('/players/:playerId', function (req, res) {
  if (!checkAdmin(req, res)) return;
  deletePlayer(req.params.playerId);
  res.json({ ok: true });
});

// POST /api/admin/reset-record/:playerId
router.post('/reset-record/:playerId', function (req, res) {
  if (!checkAdmin(req, res)) return;
  resetRecord(req.params.playerId);
  res.json({ ok: true });
});

// DELETE /api/admin/all
router.delete('/all', function (req, res) {
  if (!checkAdmin(req, res)) return;
  wipeAllPlayers();
  res.json({ ok: true, message: 'All players deleted' });
});

// Admin HTML page
export function adminPage(req, res) {
  res.send(ADMIN_HTML);
}

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
  fetch('/api/admin/players',{headers:{'X-Admin-Key':adminKey}})
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
        gear=slots.map(function(s){return typeof s==='string'?s:(s.baseKey||'?')}).join(', ');
      }
      var rec=p.record?(p.record.wins+'W / '+p.record.losses+'L'):'0W / 0L';
      var ago=p.uploadedAt?timeAgo(p.uploadedAt):'never';
      tr.innerHTML='<td><b>'+esc(p.playerName)+'</b><div style="font-size:.65rem;color:#666">'+p.playerId.slice(0,8)+'...</div></td>'+
        '<td>'+buildInfo+(gear?'<div class="gear-list">'+esc(gear)+'</div>':'')+'</td>'+
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
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
</script>
</body></html>`;

export default router;
