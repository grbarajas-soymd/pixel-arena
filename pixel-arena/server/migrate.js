// =============== MIGRATION: characters.json → SQLite ===============
// Run once: node server/migrate.js
//
// Reads existing characters.json and imports all players into the SQLite database.
// Safe to run multiple times — uses INSERT OR IGNORE.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB, getDB, initTransactions } from './db.js';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var JSON_FILE = path.join(__dirname, 'data', 'characters.json');

if (!fs.existsSync(JSON_FILE)) {
  console.log('No characters.json found at', JSON_FILE);
  console.log('Nothing to migrate.');
  process.exit(0);
}

console.log('Reading', JSON_FILE, '...');
var data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));

if (!data.players || Object.keys(data.players).length === 0) {
  console.log('No players found in characters.json');
  process.exit(0);
}

console.log('Found', Object.keys(data.players).length, 'players');
console.log('Initializing SQLite...');

initDB();
initTransactions();
var db = getDB();

var insertPlayer = db.prepare('INSERT OR IGNORE INTO players (id, name) VALUES (?, ?)');
var insertRecord = db.prepare('INSERT OR IGNORE INTO records (player_id, wins, losses) VALUES (?, ?, ?)');
var insertStats = db.prepare('INSERT OR IGNORE INTO stats (player_id, ladder_best, dungeon_clears) VALUES (?, ?, ?)');
var insertBuild = db.prepare('INSERT OR IGNORE INTO builds (player_id, build_json, uploaded_at) VALUES (?, ?, ?)');

var migrate = db.transaction(function () {
  var count = 0;
  for (var id in data.players) {
    var p = data.players[id];
    insertPlayer.run(id, p.playerName || 'Unknown');
    insertRecord.run(id, (p.record && p.record.wins) || 0, (p.record && p.record.losses) || 0);
    insertStats.run(id, p.ladderBest || 0, p.dungeonClears || 0);
    if (p.character) {
      insertBuild.run(id, JSON.stringify(p.character), p.uploadedAt || new Date().toISOString());
    }
    count++;
  }
  return count;
});

var migrated = migrate();
console.log('Migrated', migrated, 'players to SQLite');
console.log('Database file:', path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'arena.db'));
console.log('Done! You can now start the server with: npm run server');
