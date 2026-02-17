// =============== ARENA API ROUTES ===============
import { Router } from 'express';
import crypto from 'crypto';
import {
  createPlayer, getPlayer, upsertBuild, getBuild,
  listOpponents, reportBattle, updateStats, getLeaderboard,
  matchOpponent, getRecord
} from '../db.js';

var router = Router();

// POST /api/register — create player identity
router.post('/register', function (req, res) {
  var name = (req.body.name || '').trim();
  if (!name || name.length < 1 || name.length > 20) {
    return res.status(400).json({ error: 'Name required (1-20 chars)' });
  }
  var safeName = name.replace(/<[^>]*>/g, '');
  var playerId = crypto.randomUUID();
  createPlayer(playerId, safeName);
  res.json({ playerId: playerId });
});

// PUT /api/characters — upload/update build
router.put('/characters', function (req, res) {
  var playerId = req.headers['x-player-id'];
  if (!playerId) return res.status(401).json({ error: 'Missing X-Player-Id header' });
  var player = getPlayer(playerId);
  if (!player) return res.status(404).json({ error: 'Player not found' });

  var build = req.body;
  if (!build || typeof build !== 'object') {
    return res.status(400).json({ error: 'Invalid build data' });
  }

  upsertBuild(playerId, JSON.stringify(build));
  res.json({ ok: true });
});

// GET /api/characters — list all opponents (exclude self)
router.get('/characters', function (req, res) {
  var exclude = req.query.exclude || '';
  var rows = listOpponents(exclude);
  var list = rows.map(function (r) {
    return {
      playerId: r.playerId,
      playerName: r.playerName,
      character: JSON.parse(r.build_json),
      record: { wins: r.wins, losses: r.losses },
      uploadedAt: r.uploaded_at
    };
  });
  res.json(list);
});

// GET /api/characters/:playerId — single player build
router.get('/characters/:playerId', function (req, res) {
  var row = getBuild(req.params.playerId);
  if (!row) return res.status(404).json({ error: 'Build not found' });
  var rec = getRecord(req.params.playerId);
  res.json({
    playerId: req.params.playerId,
    playerName: row.player_name,
    character: JSON.parse(row.build_json),
    record: { wins: rec ? rec.wins : 0, losses: rec ? rec.losses : 0 }
  });
});

// POST /api/battles — report result (atomic transaction)
router.post('/battles', function (req, res) {
  var { challengerId, defenderId, challengerWon } = req.body;
  if (!challengerId || !defenderId) {
    return res.status(400).json({ error: 'Missing IDs' });
  }
  reportBattle(challengerId, defenderId, challengerWon);
  res.json({ ok: true });
});

// POST /api/stats — sync local stats to server (only accepts higher values)
router.post('/stats', function (req, res) {
  var playerId = req.headers['x-player-id'];
  if (!playerId) return res.status(401).json({ error: 'Missing X-Player-Id header' });
  var player = getPlayer(playerId);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  updateStats(playerId, req.body.ladderBest || 0, req.body.dungeonClears || 0);
  res.json({ ok: true });
});

// GET /api/leaderboard — top 20 rankings
router.get('/leaderboard', function (req, res) {
  res.json(getLeaderboard());
});

// GET /api/opponent — match by rating
router.get('/opponent', function (req, res) {
  var rating = parseInt(req.query.rating) || 1000;
  var exclude = req.query.exclude || '';
  var opponent = matchOpponent(rating, exclude);
  if (!opponent) return res.status(404).json({ error: 'No opponents available' });
  res.json({
    playerId: opponent.playerId,
    playerName: opponent.playerName,
    character: JSON.parse(opponent.build_json),
    record: { wins: opponent.wins, losses: opponent.losses },
    rating: opponent.arena_rating,
    uploadedAt: opponent.uploaded_at
  });
});

export default router;
