// =============== SQLite DATABASE LAYER ===============
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
var DB_PATH = path.join(DATA_DIR, 'arena.db');

var db;

export function initDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Run schema
  var schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  return db;
}

export function getDB() {
  return db;
}

// ---- Prepared statements ----

var _stmts = {};

function stmt(key, sql) {
  if (!_stmts[key]) _stmts[key] = db.prepare(sql);
  return _stmts[key];
}

// -- Users --

export function createUser(id, username, passwordHash) {
  stmt('createUser', 'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(id, username, passwordHash);
}

export function getUserByUsername(username) {
  return stmt('getUserByUsername', 'SELECT * FROM users WHERE username = ?').get(username);
}

export function getUserById(id) {
  return stmt('getUserById', 'SELECT id, username, created_at FROM users WHERE id = ?').get(id);
}

// -- Saves --

export function getSave(userId) {
  return stmt('getSave', 'SELECT save_json, updated_at FROM saves WHERE user_id = ?').get(userId);
}

export function upsertSave(userId, saveJson) {
  stmt('upsertSave', `INSERT INTO saves (user_id, save_json, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET save_json = excluded.save_json, updated_at = excluded.updated_at`).run(userId, saveJson);
}

export function deleteSave(userId) {
  stmt('deleteSave', 'DELETE FROM saves WHERE user_id = ?').run(userId);
}

// -- Players (arena) --

export function createPlayer(id, name, userId) {
  stmt('createPlayer', 'INSERT INTO players (id, name, user_id) VALUES (?, ?, ?)').run(id, name, userId || null);
  stmt('createRecord', 'INSERT INTO records (player_id) VALUES (?)').run(id);
  stmt('createStats', 'INSERT INTO stats (player_id) VALUES (?)').run(id);
}

export function getPlayer(id) {
  return stmt('getPlayer', 'SELECT * FROM players WHERE id = ?').get(id);
}

export function getPlayerByUserId(userId) {
  return stmt('getPlayerByUserId', 'SELECT * FROM players WHERE user_id = ?').get(userId);
}

export function getRecord(playerId) {
  return stmt('getRecord', 'SELECT wins, losses FROM records WHERE player_id = ?').get(playerId);
}

// -- Builds --

export function upsertBuild(playerId, buildJson) {
  stmt('upsertBuild', `INSERT INTO builds (player_id, build_json, uploaded_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(player_id) DO UPDATE SET build_json = excluded.build_json, uploaded_at = excluded.uploaded_at`).run(playerId, buildJson);
}

export function getBuild(playerId) {
  return stmt('getBuild', `SELECT b.build_json, b.uploaded_at, p.name as player_name
    FROM builds b JOIN players p ON p.id = b.player_id WHERE b.player_id = ?`).get(playerId);
}

export function listOpponents(excludeId) {
  return stmt('listOpponents', `SELECT p.id as playerId, p.name as playerName, b.build_json, b.uploaded_at,
    r.wins, r.losses FROM builds b
    JOIN players p ON p.id = b.player_id
    JOIN records r ON r.player_id = b.player_id
    WHERE p.id != ? AND json_extract(b.build_json, '$._v') >= 1`).all(excludeId || '');
}

// -- Battles --

export var reportBattle = null; // initialized after db is ready

export function initTransactions() {
  reportBattle = db.transaction(function (challengerId, defenderId, challengerWon) {
    var cPlayer = stmt('getPlayer', 'SELECT * FROM players WHERE id = ?').get(challengerId);
    var dPlayer = stmt('getPlayer', 'SELECT * FROM players WHERE id = ?').get(defenderId);

    if (cPlayer) {
      if (challengerWon) {
        stmt('incWins', 'UPDATE records SET wins = wins + 1 WHERE player_id = ?').run(challengerId);
      } else {
        stmt('incLosses', 'UPDATE records SET losses = losses + 1 WHERE player_id = ?').run(challengerId);
      }
    }
    if (dPlayer) {
      if (challengerWon) {
        stmt('incLosses', 'UPDATE records SET losses = losses + 1 WHERE player_id = ?').run(defenderId);
      } else {
        stmt('incWins', 'UPDATE records SET wins = wins + 1 WHERE player_id = ?').run(defenderId);
      }
    }

    stmt('insertBattle', 'INSERT INTO battles (challenger_id, defender_id, challenger_won) VALUES (?, ?, ?)').run(challengerId, defenderId, challengerWon ? 1 : 0);
  });
}

// -- Pending battles (battle tokens) --

export function createPendingBattle(challengerId, defenderId, token) {
  // Remove any existing pending battle for this challenger (one at a time)
  stmt('deletePendingByChallenger', 'DELETE FROM pending_battles WHERE challenger_id = ?').run(challengerId);
  stmt('createPending', 'INSERT INTO pending_battles (challenger_id, defender_id, token) VALUES (?, ?, ?)').run(challengerId, defenderId, token);
}

export function consumePendingBattle(token, challengerId) {
  var row = stmt('getPending', 'SELECT * FROM pending_battles WHERE token = ? AND challenger_id = ?').get(token, challengerId);
  if (row) {
    stmt('deletePending', 'DELETE FROM pending_battles WHERE id = ?').run(row.id);
  }
  return row;
}

export function cleanExpiredBattles() {
  stmt('cleanPending', "DELETE FROM pending_battles WHERE created_at < datetime('now', '-10 minutes')").run();
}

// -- Recent battle dedup check --

export function recentBattleExists(challengerId, defenderId, seconds) {
  return stmt('recentBattle', `SELECT id FROM battles
    WHERE challenger_id = ? AND defender_id = ? AND fought_at > datetime('now', '-' || ? || ' seconds')
    LIMIT 1`).get(challengerId, defenderId, seconds || 30);
}

// -- Stats --

export function updateStats(playerId, ladderBest, dungeonClears) {
  stmt('updateStats', `UPDATE stats SET
    ladder_best = MAX(ladder_best, ?),
    dungeon_clears = MAX(dungeon_clears, ?)
    WHERE player_id = ?`).run(ladderBest || 0, dungeonClears || 0, playerId);
}

export function getLeaderboard() {
  var arena = stmt('lbArena', `SELECT p.id as playerId, p.name as playerName, r.wins, r.losses,
    CASE WHEN (r.wins + r.losses) > 0 THEN ROUND(CAST(r.wins AS REAL) / (r.wins + r.losses) * 100) ELSE 0 END as winRate
    FROM records r JOIN players p ON p.id = r.player_id
    WHERE r.wins > 0 OR r.losses > 0 ORDER BY r.wins DESC LIMIT 20`).all();

  var ladder = stmt('lbLadder', `SELECT p.id as playerId, p.name as playerName, s.ladder_best as ladderBest
    FROM stats s JOIN players p ON p.id = s.player_id
    WHERE s.ladder_best > 0 ORDER BY s.ladder_best DESC LIMIT 20`).all();

  var dungeon = stmt('lbDungeon', `SELECT p.id as playerId, p.name as playerName, s.dungeon_clears as dungeonClears
    FROM stats s JOIN players p ON p.id = s.player_id
    WHERE s.dungeon_clears > 0 ORDER BY s.dungeon_clears DESC LIMIT 20`).all();

  return { arena, ladder, dungeon };
}

// -- Opponent matching --

export function matchOpponent(rating, excludeId) {
  return stmt('matchOpponent', `SELECT p.id as playerId, p.name as playerName, b.build_json, b.uploaded_at,
    r.wins, r.losses, s.arena_rating
    FROM builds b
    JOIN players p ON p.id = b.player_id
    JOIN records r ON r.player_id = b.player_id
    JOIN stats s ON s.player_id = b.player_id
    WHERE p.id != ? AND json_extract(b.build_json, '$._v') >= 1
    ORDER BY ABS(s.arena_rating - ?) LIMIT 1`).get(excludeId || '', rating || 1000);
}

// -- Admin --

export function listAllPlayers() {
  return stmt('listAll', `SELECT p.id as playerId, p.name as playerName,
    b.build_json, b.uploaded_at, r.wins, r.losses,
    s.ladder_best, s.dungeon_clears
    FROM players p
    LEFT JOIN builds b ON b.player_id = p.id
    LEFT JOIN records r ON r.player_id = p.id
    LEFT JOIN stats s ON s.player_id = p.id`).all();
}

export function deletePlayer(id) {
  stmt('deletePlayer', 'DELETE FROM players WHERE id = ?').run(id);
}

export function resetRecord(id) {
  stmt('resetRecord', 'UPDATE records SET wins = 0, losses = 0 WHERE player_id = ?').run(id);
}

export function wipeAllPlayers() {
  db.exec('DELETE FROM players');
}

// -- Bug Reports --

export function createBugReport(playerId, playerName, category, description, diagnosticData, screenshotData, browserInfo, gameVersion) {
  var result = stmt('createBug', `INSERT INTO bug_reports (player_id, player_name, category, description, diagnostic_data, screenshot_data, browser_info, game_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    playerId || null, playerName || 'Anonymous', category, description,
    diagnosticData || null, screenshotData || null, browserInfo || null, gameVersion || null
  );
  return result.lastInsertRowid;
}

export function listBugReports(status, limit, offset) {
  limit = limit || 50;
  offset = offset || 0;
  if (status && status !== 'all') {
    return stmt('listBugsStatus', `SELECT id, player_id, player_name, category, substr(description, 1, 120) as description_preview,
      browser_info, game_version, status, admin_notes, created_at,
      CASE WHEN screenshot_data IS NOT NULL THEN 1 ELSE 0 END as has_screenshot,
      CASE WHEN diagnostic_data IS NOT NULL THEN 1 ELSE 0 END as has_diagnostics
      FROM bug_reports WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(status, limit, offset);
  }
  return stmt('listBugsAll', `SELECT id, player_id, player_name, category, substr(description, 1, 120) as description_preview,
    browser_info, game_version, status, admin_notes, created_at,
    CASE WHEN screenshot_data IS NOT NULL THEN 1 ELSE 0 END as has_screenshot,
    CASE WHEN diagnostic_data IS NOT NULL THEN 1 ELSE 0 END as has_diagnostics
    FROM bug_reports ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
}

export function getBugReport(id) {
  return stmt('getBug', 'SELECT * FROM bug_reports WHERE id = ?').get(id);
}

export function updateBugStatus(id, status, adminNotes) {
  stmt('updateBug', 'UPDATE bug_reports SET status = ?, admin_notes = ? WHERE id = ?').run(status, adminNotes || '', id);
}

export function countBugReports() {
  return stmt('countBugs', `SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
    SUM(CASE WHEN status = 'acknowledged' THEN 1 ELSE 0 END) as acknowledged,
    SUM(CASE WHEN status = 'fixed' THEN 1 ELSE 0 END) as fixed,
    SUM(CASE WHEN status = 'wontfix' THEN 1 ELSE 0 END) as wontfix
    FROM bug_reports`).get();
}

// -- Analytics --

export function getTableCounts() {
  var tables = ['users', 'saves', 'players', 'builds', 'records', 'stats', 'battles', 'bug_reports'];
  var counts = {};
  for (var t of tables) {
    var row = db.prepare('SELECT COUNT(*) as c FROM ' + t).get();
    counts[t] = row.c;
  }
  return counts;
}

export function getActivePlayers24h() {
  return stmt('active24h', `SELECT COUNT(DISTINCT challenger_id) + COUNT(DISTINCT defender_id) as active
    FROM battles WHERE fought_at > datetime('now', '-1 day')`).get().active || 0;
}

export function getRecentBattles(limit) {
  return stmt('recentBattles', `SELECT b.id, b.fought_at, b.challenger_won,
    p1.name as challenger_name, p2.name as defender_name
    FROM battles b
    LEFT JOIN players p1 ON p1.id = b.challenger_id
    LEFT JOIN players p2 ON p2.id = b.defender_id
    ORDER BY b.fought_at DESC LIMIT ?`).all(limit || 10);
}

export function getDailyBattleCounts(days) {
  return stmt('dailyBattles', `SELECT date(fought_at) as day, COUNT(*) as count
    FROM battles WHERE fought_at > datetime('now', '-' || ? || ' days')
    GROUP BY date(fought_at) ORDER BY day`).all(days || 30);
}

export function getDailyRegistrations(days) {
  return stmt('dailyRegs', `SELECT date(created_at) as day, COUNT(*) as count
    FROM players WHERE created_at > datetime('now', '-' || ? || ' days')
    GROUP BY date(created_at) ORDER BY day`).all(days || 30);
}

export function getDailyActivePlayers(days) {
  return stmt('dailyActive', `SELECT day, COUNT(DISTINCT pid) as count FROM (
    SELECT date(fought_at) as day, challenger_id as pid FROM battles WHERE fought_at > datetime('now', '-' || ? || ' days')
    UNION ALL
    SELECT date(fought_at) as day, defender_id as pid FROM battles WHERE fought_at > datetime('now', '-' || ? || ' days')
  ) GROUP BY day ORDER BY day`).all(days || 30, days || 30);
}

export function getWinRateBySprite() {
  return stmt('winBySprite', `SELECT
    json_extract(bu.build_json, '$.sprite') as sprite,
    COUNT(*) as total_battles,
    SUM(CASE WHEN b.challenger_won = 1 THEN 1 ELSE 0 END) as wins
    FROM battles b
    JOIN builds bu ON bu.player_id = b.challenger_id
    GROUP BY sprite ORDER BY total_battles DESC`).all();
}

export function getTopSkills(limit) {
  return stmt('topSkills', `SELECT skill_id, COUNT(*) as usage_count,
    SUM(wins) as total_wins, SUM(total) as total_battles
    FROM (
      SELECT json_extract(bu.build_json, '$.skills[0]') as skill_id,
        CASE WHEN b.challenger_won = 1 THEN 1 ELSE 0 END as wins, 1 as total
        FROM battles b JOIN builds bu ON bu.player_id = b.challenger_id
        WHERE json_extract(bu.build_json, '$.skills[0]') IS NOT NULL
      UNION ALL
      SELECT json_extract(bu.build_json, '$.skills[1]') as skill_id,
        CASE WHEN b.challenger_won = 1 THEN 1 ELSE 0 END as wins, 1 as total
        FROM battles b JOIN builds bu ON bu.player_id = b.challenger_id
        WHERE json_extract(bu.build_json, '$.skills[1]') IS NOT NULL
    ) GROUP BY skill_id ORDER BY usage_count DESC LIMIT ?`).all(limit || 10);
}

export function getTopWeapons(limit) {
  return stmt('topWeapons', `SELECT weapon_key, COUNT(*) as usage_count,
    SUM(wins) as total_wins, SUM(total) as total_battles
    FROM (
      SELECT COALESCE(
        json_extract(bu.build_json, '$.equipment.weapon.baseKey'),
        json_extract(bu.build_json, '$.equipment.weapon')
      ) as weapon_key,
        CASE WHEN b.challenger_won = 1 THEN 1 ELSE 0 END as wins, 1 as total
        FROM battles b JOIN builds bu ON bu.player_id = b.challenger_id
        WHERE json_extract(bu.build_json, '$.equipment.weapon') IS NOT NULL
    ) WHERE weapon_key IS NOT NULL GROUP BY weapon_key ORDER BY usage_count DESC LIMIT ?`).all(limit || 10);
}

export function getWinRateDistribution() {
  return stmt('winDist', `SELECT
    CAST(ROUND(CAST(r.wins AS REAL) / MAX(r.wins + r.losses, 1) * 10) * 10 AS INTEGER) as bracket,
    COUNT(*) as count
    FROM records r WHERE (r.wins + r.losses) >= 5
    GROUP BY bracket ORDER BY bracket`).all();
}

export function getDBFileSize() {
  var row = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get();
  return row ? row.size : 0;
}
