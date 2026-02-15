// =============== PIXEL ARENA — EXPRESS API ===============
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var DATA_DIR = path.join(__dirname, 'data');
var DB_FILE = path.join(DATA_DIR, 'characters.json');
var PORT = 3001;

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

var app = express();
app.use(cors());
app.use(express.json());

// POST /api/register — create player identity
app.post('/api/register', function (req, res) {
  var name = (req.body.name || '').trim();
  if (!name || name.length > 20) return res.status(400).json({ error: 'Name required (max 20 chars)' });
  var playerId = crypto.randomUUID();
  var db = readDB();
  db.players[playerId] = { playerName: name, character: null, record: { wins: 0, losses: 0 }, uploadedAt: null };
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

app.listen(PORT, function () {
  console.log('Pixel Arena API listening on port ' + PORT);
});
