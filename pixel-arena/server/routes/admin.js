// =============== ADMIN ROUTES ===============
import { Router } from 'express';
import {
  listAllPlayers, deletePlayer, resetRecord, wipeAllPlayers,
  listBugReports, getBugReport, updateBugStatus, countBugReports,
  getTableCounts, getActivePlayers24h, getRecentBattles,
  getDailyBattleCounts, getDailyRegistrations, getDailyActivePlayers,
  getWinRateBySprite, getTopSkills, getTopWeapons, getWinRateDistribution,
  getDBFileSize
} from '../db.js';
import { VALID_SPRITES, AUDIT_STAT_CAPS } from '../shared.js';

var router = Router();

var ADMIN_KEY = process.env.ADMIN_KEY || 'admin';
var SERVER_START = Date.now();

function checkAdmin(req, res) {
  var key = req.headers['x-admin-key'] || req.query.key;
  if (key !== ADMIN_KEY) {
    res.status(403).json({ error: 'Invalid admin key' });
    return false;
  }
  return true;
}

// ---- Existing player management ----

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

// ---- New dashboard API routes ----

// GET /api/admin/overview
router.get('/overview', function (req, res) {
  if (!checkAdmin(req, res)) return;
  var counts = getTableCounts();
  var active24h = getActivePlayers24h();
  var recentBattles = getRecentBattles(10);
  var bugCounts = countBugReports();
  var dbSize = getDBFileSize();
  var uptime = Date.now() - SERVER_START;
  res.json({
    uptime: uptime,
    dbSize: dbSize,
    tableCounts: counts,
    active24h: active24h,
    recentBattles: recentBattles,
    bugCounts: bugCounts
  });
});

// GET /api/admin/bugs
router.get('/bugs', function (req, res) {
  if (!checkAdmin(req, res)) return;
  var status = req.query.status || 'all';
  var limit = parseInt(req.query.limit) || 50;
  var offset = parseInt(req.query.offset) || 0;
  var bugs = listBugReports(status, limit, offset);
  var counts = countBugReports();
  res.json({ bugs: bugs, counts: counts });
});

// GET /api/admin/bugs/:id
router.get('/bugs/:id', function (req, res) {
  if (!checkAdmin(req, res)) return;
  var bug = getBugReport(parseInt(req.params.id));
  if (!bug) return res.status(404).json({ error: 'Bug report not found' });
  res.json(bug);
});

// PUT /api/admin/bugs/:id
router.put('/bugs/:id', function (req, res) {
  if (!checkAdmin(req, res)) return;
  var { status, admin_notes } = req.body;
  var valid = ['open', 'acknowledged', 'fixed', 'wontfix'];
  if (status && valid.indexOf(status) === -1) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  updateBugStatus(parseInt(req.params.id), status || 'open', admin_notes || '');
  res.json({ ok: true });
});

// GET /api/admin/analytics/balance
router.get('/analytics/balance', function (req, res) {
  if (!checkAdmin(req, res)) return;
  res.json({
    winRateBySprite: getWinRateBySprite(),
    topSkills: getTopSkills(10),
    topWeapons: getTopWeapons(10),
    winRateDistribution: getWinRateDistribution()
  });
});

// GET /api/admin/analytics/activity
router.get('/analytics/activity', function (req, res) {
  if (!checkAdmin(req, res)) return;
  var days = parseInt(req.query.days) || 30;
  res.json({
    dailyBattles: getDailyBattleCounts(days),
    dailyRegistrations: getDailyRegistrations(days),
    dailyActivePlayers: getDailyActivePlayers(days)
  });
});

// GET /api/admin/audit-builds — scan builds for staleness/integrity issues
router.get('/audit-builds', function (req, res) {
  if (!checkAdmin(req, res)) return;
  var rows = listAllPlayers();
  var flagged = [];
  var versionCounts = {};
  var total = 0;
  var staleCount = 0;

  rows.forEach(function (r) {
    if (!r.build_json) return;
    total++;
    var build;
    try { build = JSON.parse(r.build_json); } catch (e) { flagged.push({ playerId: r.playerId, playerName: r.playerName, issues: ['Invalid JSON in build'] }); return; }

    var issues = [];
    var v = build._v || 0;
    versionCounts[v] = (versionCounts[v] || 0) + 1;
    if (!v) { issues.push('No build version (pre-validation upload)'); staleCount++; }

    // Check stats exceed theoretical maximums
    if (build.stats) {
      for (var cap in AUDIT_STAT_CAPS) {
        if (typeof build.stats[cap] === 'number' && build.stats[cap] > AUDIT_STAT_CAPS[cap]) {
          issues.push(cap + ' = ' + build.stats[cap] + ' exceeds cap ' + AUDIT_STAT_CAPS[cap]);
        }
      }
    }

    // Check skill indices
    if (build.skills) {
      build.skills.forEach(function (idx, i) {
        if (idx !== null && (typeof idx !== 'number' || idx < 0 || idx > 18)) {
          issues.push('Invalid skill[' + i + '] = ' + idx);
        }
      });
    }

    // Check ultimate
    if (build.ultimate !== null && (typeof build.ultimate !== 'number' || build.ultimate < 0 || build.ultimate > 7)) {
      issues.push('Invalid ultimate = ' + build.ultimate);
    }

    // Check sprite
    if (build.sprite && VALID_SPRITES.indexOf(build.sprite) === -1) {
      issues.push('Invalid sprite: ' + build.sprite);
    }

    if (issues.length) {
      flagged.push({
        playerId: r.playerId, playerName: r.playerName,
        uploadedAt: r.uploaded_at, version: v,
        issues: issues
      });
    }
  });

  res.json({
    totalBuilds: total,
    staleBuilds: staleCount,
    flaggedCount: flagged.length,
    versionCounts: versionCounts,
    flagged: flagged
  });
});

// ---- Admin HTML page ----

export function adminPage(req, res) {
  res.send(ADMIN_HTML);
}

var ADMIN_HTML = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin — Some of You May Die</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#1a1a2e;color:#e0e0e0;padding:20px;max-width:1100px;margin:0 auto}
h1{color:#c8a848;margin-bottom:4px;font-size:1.4rem}
.sub{color:#888;margin-bottom:16px;font-size:.85rem}
.login{background:#16213e;padding:20px;border-radius:8px;margin-bottom:16px}
.login input{background:#0f3460;border:1px solid #444;color:#fff;padding:8px 12px;border-radius:4px;margin-right:8px;font-size:.9rem}
.login button{background:#c8a848;color:#1a1a2e;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-weight:700;font-size:.85rem}
.btn{background:#c8a848;color:#1a1a2e;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-weight:700;font-size:.85rem}
.btn:hover{background:#d8b858}
.btn-danger{background:#aa3a3a;color:#fff}
.btn-danger:hover{background:#cc4444}
.btn-sm{padding:4px 10px;font-size:.75rem}
#content{display:none}

/* Tabs */
.tabs{display:flex;gap:2px;margin-bottom:16px;border-bottom:2px solid #333}
.tab{padding:10px 20px;cursor:pointer;color:#888;font-size:.85rem;font-weight:600;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .2s}
.tab:hover{color:#c8a848}
.tab.active{color:#c8a848;border-bottom-color:#c8a848}
.tab-panel{display:none}
.tab-panel.active{display:block}

/* Stat cards */
.stats{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.stat-card{background:#16213e;padding:12px 20px;border-radius:8px;text-align:center;min-width:120px}
.stat-num{font-size:1.6rem;font-weight:700;color:#c8a848}
.stat-label{font-size:.72rem;color:#888}

/* Tables */
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:.85rem}
th{text-align:left;padding:8px;border-bottom:2px solid #333;color:#c8a848;font-size:.75rem;text-transform:uppercase}
td{padding:8px;border-bottom:1px solid #222}
tr:hover{background:rgba(22,33,62,0.5)}
.gear-list{font-size:.7rem;color:#888}
.actions{display:flex;gap:4px}
.empty{color:#666;font-style:italic;padding:20px;text-align:center}

/* Bug status badges */
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:700}
.badge-open{background:#2a4a2a;color:#6a9}
.badge-acknowledged{background:#3a3a1a;color:#c8a848}
.badge-fixed{background:#1a3a4a;color:#6a9aba}
.badge-wontfix{background:#3a2a2a;color:#aa6a5a}

/* Bug detail panel */
.bug-detail{background:#12192e;border:1px solid #333;border-radius:8px;padding:16px;margin-top:12px}
.bug-detail h3{color:#c8a848;font-size:.95rem;margin-bottom:8px}
.bug-field{margin-bottom:8px}
.bug-field label{display:block;font-size:.72rem;color:#888;margin-bottom:2px}
.bug-field .val{font-size:.85rem;white-space:pre-wrap;line-height:1.5}
.bug-diag{background:#0d1220;border:1px solid #2a2a3a;border-radius:4px;padding:10px;font-family:monospace;font-size:.75rem;max-height:300px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;line-height:1.4}
.bug-screenshot{max-width:100%;max-height:400px;border:1px solid #333;border-radius:4px;margin-top:4px}
select.status-sel{background:#0f3460;border:1px solid #444;color:#fff;padding:4px 8px;border-radius:4px;font-size:.8rem}
textarea.notes-input{width:100%;background:#0f3460;border:1px solid #444;color:#fff;padding:8px;border-radius:4px;font-size:.8rem;min-height:60px;resize:vertical}
.filter-bar{display:flex;gap:8px;align-items:center;margin-bottom:12px}

/* Charts */
.chart{margin-bottom:20px}
.chart-title{font-size:.85rem;color:#c8a848;font-weight:700;margin-bottom:8px}
.chart-row{display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:.8rem}
.chart-label{min-width:120px;text-align:right;color:#aaa;font-size:.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chart-bar-wrap{flex:1;height:22px;background:#0f1830;border-radius:3px;overflow:hidden;position:relative}
.chart-bar{height:100%;border-radius:3px;transition:width .3s;min-width:2px}
.chart-bar.gold{background:linear-gradient(90deg,#8a7a30,#c8a848)}
.chart-bar.teal{background:linear-gradient(90deg,#2a5a4a,#5a9a7a)}
.chart-bar.fire{background:linear-gradient(90deg,#6a3a1a,#b85a2a)}
.chart-bar.ice{background:linear-gradient(90deg,#2a4a6a,#5a8aaa)}
.chart-bar.purple{background:linear-gradient(90deg,#3a2a5a,#6a4a8a)}
.chart-val{min-width:60px;font-size:.75rem;color:#888}
.info-row{display:flex;justify-content:space-between;font-size:.8rem;padding:4px 0;border-bottom:1px solid #1a1a30}
.info-label{color:#888}
.info-val{color:#e0e0e0;font-weight:600}
.section{background:#16213e;border-radius:8px;padding:14px;margin-bottom:16px}
.section-title{font-size:.9rem;color:#c8a848;font-weight:700;margin-bottom:10px}
</style>
</head><body>
<h1>Admin Dashboard</h1>
<div class="sub">Some of You May Die — Server Management</div>

<div class="login" id="loginBox">
  <input type="password" id="keyInput" placeholder="Admin key..." onkeydown="if(event.key==='Enter')doLogin()">
  <button onclick="doLogin()">Login</button>
</div>

<div id="content">
  <div class="tabs">
    <div class="tab active" onclick="switchTab('overview')">Overview</div>
    <div class="tab" onclick="switchTab('players')">Players</div>
    <div class="tab" onclick="switchTab('bugs')">Bugs <span id="bugBadge" style="font-size:.65rem;color:#6a9"></span></div>
    <div class="tab" onclick="switchTab('balance')">Balance</div>
    <div class="tab" onclick="switchTab('activity')">Activity</div>
    <div class="tab" onclick="switchTab('dio')">Dio</div>
  </div>

  <!-- OVERVIEW TAB -->
  <div id="tab-overview" class="tab-panel active">
    <div class="stats" id="overviewStats"></div>
    <div class="section">
      <div class="section-title">Server Info</div>
      <div id="serverInfo"></div>
    </div>
    <div class="section">
      <div class="section-title">Table Row Counts</div>
      <div id="tableCounts"></div>
    </div>
    <div class="section">
      <div class="section-title">Recent Battles</div>
      <table><thead><tr><th>Time</th><th>Challenger</th><th>Defender</th><th>Result</th></tr></thead>
      <tbody id="recentBattles"></tbody></table>
    </div>
  </div>

  <!-- PLAYERS TAB -->
  <div id="tab-players" class="tab-panel">
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="btn" onclick="refreshPlayers()">Refresh</button>
      <button class="btn btn-danger" onclick="wipeAll()">Wipe All Players</button>
    </div>
    <table>
      <thead><tr><th>Name</th><th>Build</th><th>Record</th><th>Uploaded</th><th>Actions</th></tr></thead>
      <tbody id="playerRows"></tbody>
    </table>
    <div class="empty" id="emptyMsg" style="display:none">No players registered yet.</div>
  </div>

  <!-- BUGS TAB -->
  <div id="tab-bugs" class="tab-panel">
    <div class="filter-bar">
      <label style="font-size:.8rem;color:#888">Status:</label>
      <select class="status-sel" id="bugFilter" onchange="loadBugs()">
        <option value="all">All</option>
        <option value="open" selected>Open</option>
        <option value="acknowledged">Acknowledged</option>
        <option value="fixed">Fixed</option>
        <option value="wontfix">Won't Fix</option>
      </select>
      <button class="btn btn-sm" onclick="loadBugs()">Refresh</button>
      <span id="bugCountsLine" style="font-size:.75rem;color:#888;margin-left:auto"></span>
    </div>
    <table>
      <thead><tr><th>ID</th><th>Date</th><th>Player</th><th>Category</th><th>Description</th><th>Status</th><th></th></tr></thead>
      <tbody id="bugRows"></tbody>
    </table>
    <div id="bugDetail"></div>
  </div>

  <!-- BALANCE TAB -->
  <div id="tab-balance" class="tab-panel">
    <button class="btn btn-sm" onclick="loadBalance()" style="margin-bottom:12px">Refresh</button>
    <div id="balanceCharts"></div>
  </div>

  <!-- ACTIVITY TAB -->
  <div id="tab-activity" class="tab-panel">
    <button class="btn btn-sm" onclick="loadActivity()" style="margin-bottom:12px">Refresh</button>
    <div id="activityCharts"></div>
  </div>

  <!-- DIO TAB -->
  <div id="tab-dio" class="tab-panel">
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="btn" onclick="dioGenerate()">Force Generate</button>
      <button class="btn btn-sm" onclick="loadDio()">Refresh</button>
    </div>
    <div id="dioStatus" style="margin-bottom:12px"></div>
    <div class="section">
      <div class="section-title">Batches</div>
      <table><thead><tr><th>ID</th><th>Status</th><th>Lines</th><th>Generated</th><th>Expires</th><th>Actions</th></tr></thead>
      <tbody id="dioBatches"></tbody></table>
    </div>
    <div class="section" id="dioLineSection" style="display:none">
      <div class="section-title">Lines — Batch <span id="dioLineBatchId"></span></div>
      <table><thead><tr><th>Category</th><th>Line</th><th>Trend</th><th>Actions</th></tr></thead>
      <tbody id="dioLines"></tbody></table>
    </div>
  </div>
</div>

<script>
var adminKey=localStorage.getItem('adminKey')||'';
var SKILL_NAMES=['Chain Lightning','Lightning Bolt','Static Shield',"Hunter's Mark",'Bloodlust','Summon Pet','Shadow Step','Envenom','Smoke Bomb','Charge','War Cry','Frost Nova','Arcane Drain','Rupture','Marked for Death','Lacerate','Riposte','Battle Trance','Thorns'];
var ULT_NAMES=['Thunderstorm','Rain of Fire','Death Mark','Berserker Rage','Arcane Overload','Primal Fury','Shadow Dance','Last Stand'];

if(adminKey){
  api('GET','/api/admin/overview').then(function(){
    document.getElementById('loginBox').style.display='none';
    document.getElementById('content').style.display='block';
    loadOverview();
  }).catch(function(){adminKey='';localStorage.removeItem('adminKey')});
}

function doLogin(){
  adminKey=document.getElementById('keyInput').value;
  api('GET','/api/admin/overview').then(function(){
    localStorage.setItem('adminKey',adminKey);
    document.getElementById('loginBox').style.display='none';
    document.getElementById('content').style.display='block';
    loadOverview();
  }).catch(function(){alert('Invalid admin key')});
}

function api(method,path,body){
  var opts={method:method,headers:{'X-Admin-Key':adminKey,'Content-Type':'application/json'}};
  if(body)opts.body=JSON.stringify(body);
  return fetch(path,opts).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()});
}

function switchTab(name){
  document.querySelectorAll('.tab').forEach(function(t,i){
    var tabs=['overview','players','bugs','balance','activity','dio'];
    t.classList.toggle('active',tabs[i]===name);
  });
  document.querySelectorAll('.tab-panel').forEach(function(p){p.classList.remove('active')});
  document.getElementById('tab-'+name).classList.add('active');
  if(name==='overview')loadOverview();
  if(name==='players')refreshPlayers();
  if(name==='bugs')loadBugs();
  if(name==='balance')loadBalance();
  if(name==='activity')loadActivity();
  if(name==='dio')loadDio();
}

// ===== OVERVIEW =====
function loadOverview(){
  api('GET','/api/admin/overview').then(function(d){
    var s=d.tableCounts||{};
    var bc=d.bugCounts||{};
    document.getElementById('overviewStats').innerHTML=
      statCard(s.players||0,'Total Players')+
      statCard(s.battles||0,'Total Battles')+
      statCard(bc.open||0,'Open Bugs')+
      statCard(d.active24h||0,'Active (24h)');
    document.getElementById('bugBadge').textContent=bc.open?'('+bc.open+')':'';

    var up=d.uptime||0;
    var hrs=Math.floor(up/3600000);var mins=Math.floor((up%3600000)/60000);
    var dbMB=(d.dbSize/(1024*1024)).toFixed(2);
    document.getElementById('serverInfo').innerHTML=
      infoRow('Uptime',hrs+'h '+mins+'m')+
      infoRow('DB File Size',dbMB+' MB');

    var tc='';
    for(var t in s)tc+=infoRow(t,s[t]);
    document.getElementById('tableCounts').innerHTML=tc;

    var rb=d.recentBattles||[];
    document.getElementById('recentBattles').innerHTML=rb.map(function(b){
      return '<tr><td style="font-size:.75rem;color:#888">'+timeAgo(b.fought_at)+'</td>'+
        '<td>'+esc(b.challenger_name||'?')+'</td>'+
        '<td>'+esc(b.defender_name||'?')+'</td>'+
        '<td style="color:'+(b.challenger_won?'#6a9':'#aa6a5a')+'">'+
        (b.challenger_won?'Challenger won':'Defender won')+'</td></tr>';
    }).join('');
  });
}

// ===== PLAYERS =====
function refreshPlayers(){
  api('GET','/api/admin/players').then(function(data){
    var players=data.players||[];
    var tbody=document.getElementById('playerRows');
    tbody.innerHTML='';
    document.getElementById('emptyMsg').style.display=players.length?'none':'block';
    players.forEach(function(p){
      var tr=document.createElement('tr');
      var ch=p.character;
      var buildInfo=ch?esc(ch.name)+' ('+esc(ch.sprite)+')':'<span style="color:#666">—</span>';
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
        if(confirm('Reset '+p.playerName+"'s record?"))
          api('POST','/api/admin/reset-record/'+p.playerId).then(refreshPlayers);
      };
      var delBtn=document.createElement('button');
      delBtn.className='btn btn-sm btn-danger';delBtn.textContent='Delete';
      delBtn.onclick=function(){
        if(confirm('Delete '+p.playerName+'? This removes them from the arena.'))
          api('DELETE','/api/admin/players/'+p.playerId).then(refreshPlayers);
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
  api('DELETE','/api/admin/all').then(refreshPlayers);
}

// ===== BUGS =====
function loadBugs(){
  var status=document.getElementById('bugFilter').value;
  api('GET','/api/admin/bugs?status='+status).then(function(d){
    var bugs=d.bugs||[];
    var c=d.counts||{};
    document.getElementById('bugCountsLine').textContent=
      'Total: '+c.total+' | Open: '+c.open+' | Ack: '+c.acknowledged+' | Fixed: '+c.fixed;
    document.getElementById('bugBadge').textContent=c.open?'('+c.open+')':'';
    var tbody=document.getElementById('bugRows');
    tbody.innerHTML='';
    if(!bugs.length){
      tbody.innerHTML='<tr><td colspan="7" class="empty">No bug reports found.</td></tr>';
      return;
    }
    bugs.forEach(function(b){
      var tr=document.createElement('tr');
      tr.innerHTML='<td>#'+b.id+'</td>'+
        '<td style="font-size:.75rem;color:#888">'+timeAgo(b.created_at)+'</td>'+
        '<td>'+esc(b.player_name)+'</td>'+
        '<td>'+esc(b.category)+'</td>'+
        '<td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(b.description_preview)+'</td>'+
        '<td><span class="badge badge-'+b.status+'">'+b.status+'</span></td>'+
        '<td><button class="btn btn-sm" onclick="viewBug('+b.id+')">View</button></td>';
      tbody.appendChild(tr);
    });
  });
}

function viewBug(id){
  api('GET','/api/admin/bugs/'+id).then(function(b){
    var diagHtml='';
    if(b.diagnostic_data){
      try{
        var diag=typeof b.diagnostic_data==='string'?JSON.parse(b.diagnostic_data):b.diagnostic_data;
        diagHtml='<div class="bug-field"><label>Diagnostic Data</label><div class="bug-diag">'+esc(JSON.stringify(diag,null,2))+'</div></div>';
      }catch(e){
        diagHtml='<div class="bug-field"><label>Diagnostic Data (raw)</label><div class="bug-diag">'+esc(b.diagnostic_data)+'</div></div>';
      }
    }
    var screenHtml='';
    if(b.screenshot_data){
      screenHtml='<div class="bug-field"><label>Screenshot</label><img class="bug-screenshot" src="'+b.screenshot_data+'"></div>';
    }
    document.getElementById('bugDetail').innerHTML=
      '<div class="bug-detail">'+
        '<h3>Bug #'+b.id+' — '+esc(b.category)+'</h3>'+
        '<div class="bug-field"><label>Player</label><div class="val">'+esc(b.player_name)+(b.player_id?' ('+b.player_id.slice(0,8)+'...)':'')+'</div></div>'+
        '<div class="bug-field"><label>Submitted</label><div class="val">'+b.created_at+'</div></div>'+
        '<div class="bug-field"><label>Browser</label><div class="val" style="font-size:.75rem;color:#888">'+esc(b.browser_info||'N/A')+'</div></div>'+
        '<div class="bug-field"><label>Description</label><div class="val">'+esc(b.description)+'</div></div>'+
        diagHtml+screenHtml+
        '<div style="display:flex;gap:12px;align-items:flex-end;margin-top:12px">'+
          '<div><label style="font-size:.72rem;color:#888">Status</label><br>'+
            '<select class="status-sel" id="bugStatusSel">'+
              '<option value="open"'+(b.status==='open'?' selected':'')+'>Open</option>'+
              '<option value="acknowledged"'+(b.status==='acknowledged'?' selected':'')+'>Acknowledged</option>'+
              '<option value="fixed"'+(b.status==='fixed'?' selected':'')+'>Fixed</option>'+
              '<option value="wontfix"'+(b.status==='wontfix'?' selected':'')+'>Won\\x27t Fix</option>'+
            '</select></div>'+
          '<div style="flex:1"><label style="font-size:.72rem;color:#888">Admin Notes</label><br>'+
            '<textarea class="notes-input" id="bugNotesInput">'+esc(b.admin_notes||'')+'</textarea></div>'+
          '<button class="btn" onclick="saveBug('+b.id+')">Save</button>'+
        '</div>'+
      '</div>';
  });
}

function saveBug(id){
  var status=document.getElementById('bugStatusSel').value;
  var notes=document.getElementById('bugNotesInput').value;
  api('PUT','/api/admin/bugs/'+id,{status:status,admin_notes:notes}).then(function(){
    loadBugs();
    document.getElementById('bugDetail').innerHTML='<div style="color:#6a9;padding:8px;font-size:.85rem">Saved!</div>';
  });
}

// ===== BALANCE =====
function loadBalance(){
  api('GET','/api/admin/analytics/balance').then(function(d){
    var html='';

    // Win rate by sprite
    var sprites=d.winRateBySprite||[];
    if(sprites.length){
      html+='<div class="chart"><div class="chart-title">Win Rate by Class</div>';
      sprites.forEach(function(s){
        var wr=s.total_battles>0?Math.round(s.wins/s.total_battles*100):0;
        html+=chartRow(s.sprite||'unknown',wr,'gold',wr+'% ('+s.total_battles+' battles)');
      });
      html+='</div>';
    }

    // Top skills
    var skills=d.topSkills||[];
    if(skills.length){
      html+='<div class="chart"><div class="chart-title">Top Skills by Usage</div>';
      var maxSkill=skills[0]?skills[0].usage_count:1;
      skills.forEach(function(s){
        var idx=parseInt(s.skill_id);
        var name=(idx>=0&&idx<SKILL_NAMES.length)?SKILL_NAMES[idx]:
                 (idx>=100&&idx-100<ULT_NAMES.length)?ULT_NAMES[idx-100]:'Skill #'+s.skill_id;
        var pct=Math.round(s.usage_count/maxSkill*100);
        var wr=s.total_battles>0?Math.round(s.total_wins/s.total_battles*100):0;
        html+=chartRow(name,pct,'teal',s.usage_count+' uses, '+wr+'% WR');
      });
      html+='</div>';
    }

    // Top weapons
    var weapons=d.topWeapons||[];
    if(weapons.length){
      html+='<div class="chart"><div class="chart-title">Top Weapons by Usage</div>';
      var maxWep=weapons[0]?weapons[0].usage_count:1;
      weapons.forEach(function(w){
        var pct=Math.round(w.usage_count/maxWep*100);
        var wr=w.total_battles>0?Math.round(w.total_wins/w.total_battles*100):0;
        var label=(w.weapon_key||'unknown').replace(/_/g,' ');
        html+=chartRow(label,pct,'fire',w.usage_count+' uses, '+wr+'% WR');
      });
      html+='</div>';
    }

    // Win rate distribution
    var dist=d.winRateDistribution||[];
    if(dist.length){
      html+='<div class="chart"><div class="chart-title">Win Rate Distribution (min 5 games)</div>';
      var maxDist=1;
      dist.forEach(function(d){if(d.count>maxDist)maxDist=d.count});
      dist.forEach(function(d){
        var pct=Math.round(d.count/maxDist*100);
        html+=chartRow(d.bracket+'%',pct,'purple',d.count+' players');
      });
      html+='</div>';
    }

    if(!html)html='<div class="empty">No battle data yet.</div>';
    document.getElementById('balanceCharts').innerHTML=html;
  });
}

// ===== ACTIVITY =====
function loadActivity(){
  api('GET','/api/admin/analytics/activity?days=30').then(function(d){
    var html='';

    html+=activityChart('Daily Battles (last 30 days)',d.dailyBattles||[],'gold');
    html+=activityChart('New Players (last 30 days)',d.dailyRegistrations||[],'teal');
    html+=activityChart('Active Players (last 30 days)',d.dailyActivePlayers||[],'ice');

    if(!html)html='<div class="empty">No activity data yet.</div>';
    document.getElementById('activityCharts').innerHTML=html;
  });
}

function activityChart(title,data,color){
  if(!data.length)return '';
  var max=1;data.forEach(function(d){if(d.count>max)max=d.count});
  var html='<div class="chart"><div class="chart-title">'+title+'</div>';
  data.forEach(function(d){
    var pct=Math.round(d.count/max*100);
    var label=d.day?d.day.slice(5):'?';
    html+=chartRow(label,pct,color,d.count);
  });
  return html+'</div>';
}

// ===== HELPERS =====
function statCard(num,label){return '<div class="stat-card"><div class="stat-num">'+num+'</div><div class="stat-label">'+label+'</div></div>'}
function infoRow(label,val){return '<div class="info-row"><span class="info-label">'+label+'</span><span class="info-val">'+val+'</span></div>'}
function chartRow(label,pct,color,valText){
  return '<div class="chart-row"><div class="chart-label">'+esc(label)+'</div>'+
    '<div class="chart-bar-wrap"><div class="chart-bar '+color+'" style="width:'+pct+'%"></div></div>'+
    '<div class="chart-val">'+esc(String(valText))+'</div></div>';
}
function timeAgo(iso){
  if(!iso)return '?';
  var d=Date.now()-new Date(iso+'Z').getTime();
  var m=Math.floor(d/60000);
  if(m<1)return 'just now';if(m<60)return m+'m ago';
  var h=Math.floor(m/60);if(h<24)return h+'h ago';
  return Math.floor(h/24)+'d ago';
}
function esc(s){if(!s)return '';var d=document.createElement('div');d.textContent=String(s);return d.innerHTML}

// ===== DIO =====
function loadDio(){
  api('GET','/api/admin/dio/batches').then(function(d){
    var batches=d.batches||[];
    var tbody=document.getElementById('dioBatches');
    if(batches.length===0){
      tbody.innerHTML='<tr><td colspan="6" class="empty">No batches yet. Click "Force Generate" to create one.</td></tr>';
      document.getElementById('dioStatus').innerHTML='<span style="color:#888">No ANTHROPIC_API_KEY? Live Dio lines are disabled without it.</span>';
      return;
    }
    document.getElementById('dioStatus').innerHTML='<span style="color:#6a9">'+batches.length+' batch(es)</span>';
    tbody.innerHTML=batches.map(function(b){
      var statusCol=b.status==='active'?'#6a9':b.status==='rejected'?'#aa6a5a':'#888';
      return '<tr><td>'+b.id+'</td>'+
        '<td><span style="color:'+statusCol+'">'+b.status+'</span></td>'+
        '<td>'+b.active_lines+'/'+b.line_count+'</td>'+
        '<td style="font-size:.75rem;color:#888">'+timeAgo(b.generated_at)+'</td>'+
        '<td style="font-size:.75rem;color:#888">'+timeAgo(b.expires_at)+'</td>'+
        '<td class="actions">'+
          '<button class="btn btn-sm" onclick="dioViewBatch('+b.id+')">View</button> '+
          (b.status==='active'?'<button class="btn btn-sm btn-danger" onclick="dioArchiveBatch('+b.id+')">Archive</button>':
           b.status!=='active'?'<button class="btn btn-sm" onclick="dioActivateBatch('+b.id+')">Activate</button>':'')+
        '</td></tr>';
    }).join('');
  });
}

function dioGenerate(){
  document.getElementById('dioStatus').innerHTML='<span style="color:#c8a848">Generating... (this takes 30-60s)</span>';
  api('POST','/api/admin/dio/generate').then(function(d){
    document.getElementById('dioStatus').innerHTML='<span style="color:#6a9">Generated batch #'+d.batchId+'!</span>';
    loadDio();
  }).catch(function(e){
    document.getElementById('dioStatus').innerHTML='<span style="color:#aa6a5a">Generation failed: '+e.message+'</span>';
  });
}

function dioViewBatch(id){
  api('GET','/api/admin/dio/batches/'+id).then(function(d){
    var lines=d.lines||[];
    document.getElementById('dioLineSection').style.display='block';
    document.getElementById('dioLineBatchId').textContent='#'+id;
    var catColors={perfect_gear:'#6a9',trash_gear:'#aa6a5a',death:'#888',victory:'#c8a848',boss_kill:'#b85a2a'};
    document.getElementById('dioLines').innerHTML=lines.map(function(l){
      var cc=catColors[l.category]||'#888';
      var flagStyle=l.flagged?'text-decoration:line-through;color:#555':'';
      return '<tr style="'+flagStyle+'"><td><span style="color:'+cc+'">'+esc(l.category)+'</span></td>'+
        '<td>'+esc(l.line_text)+'</td>'+
        '<td style="font-size:.75rem;color:#888">'+esc(l.trend_ref||'—')+'</td>'+
        '<td><button class="btn btn-sm '+(l.flagged?'':'btn-danger')+'" onclick="dioFlagLine('+l.id+','+(!l.flagged)+','+id+')">'+(l.flagged?'Unflag':'Flag')+'</button></td></tr>';
    }).join('');
  });
}

function dioFlagLine(lineId,flag,batchId){
  api('PUT','/api/admin/dio/lines/'+lineId+'/flag',{flagged:flag}).then(function(){dioViewBatch(batchId)});
}

function dioArchiveBatch(id){
  api('PUT','/api/admin/dio/batches/'+id,{status:'archived'}).then(function(){loadDio()});
}

function dioActivateBatch(id){
  api('PUT','/api/admin/dio/batches/'+id,{status:'active'}).then(function(){loadDio()});
}
</script>
</body></html>`;

export default router;
