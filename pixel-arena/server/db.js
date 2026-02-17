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
    WHERE p.id != ?`).all(excludeId || '');
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
    WHERE p.id != ?
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
