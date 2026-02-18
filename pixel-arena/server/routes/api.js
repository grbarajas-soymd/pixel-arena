// =============== ARENA API ROUTES ===============
import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth } from './auth.js';
import {
  createPlayer, getPlayer, getPlayerByUserId, upsertBuild, getBuild,
  listOpponents, reportBattle, updateStats, getLeaderboard,
  matchOpponent, getRecord, createBugReport,
  createPendingBattle, consumePendingBattle, cleanExpiredBattles,
  recentBattleExists
} from '../db.js';
import { VALID_BASE_KEYS, VALID_SPRITES, UPLOAD_STAT_CAPS } from '../shared.js';

var router = Router();

// =============== RATE LIMITING ===============

function makeRateLimiter(maxPerHour) {
  var map = {};
  return {
    check: function (key) {
      if (!map[key]) map[key] = [];
      var cutoff = Date.now() - 3600000;
      map[key] = map[key].filter(function (t) { return t > cutoff; });
      if (map[key].length >= maxPerHour) return false;
      map[key].push(Date.now());
      return true;
    },
    cleanup: function () {
      var cutoff = Date.now() - 3600000;
      for (var k in map) {
        map[k] = map[k].filter(function (t) { return t > cutoff; });
        if (map[k].length === 0) delete map[k];
      }
    }
  };
}

var buildLimiter = makeRateLimiter(10);
var bugLimiter = makeRateLimiter(5);

// Cleanup rate limit entries + expired pending battles every 10 minutes
setInterval(function () {
  buildLimiter.cleanup();
  bugLimiter.cleanup();
  cleanExpiredBattles();
}, 600000);

// =============== BUILD VALIDATION CONSTANTS ===============

var VALID_RANGE_TYPES = ['melee', 'ranged'];
var VALID_EQUIP_SLOTS = ['weapon', 'helmet', 'chest', 'boots', 'accessory'];

// =============== ARENA ENDPOINTS ===============

// POST /api/register — create player identity (JWT required)
router.post('/register', requireAuth, function (req, res) {
  // Check if user already has a player
  var existing = getPlayerByUserId(req.userId);
  if (existing) {
    return res.json({ playerId: existing.id });
  }

  var name = (req.body.name || '').trim();
  if (!name || name.length < 1 || name.length > 20) {
    return res.status(400).json({ error: 'Name required (1-20 chars)' });
  }
  var safeName = name.replace(/<[^>]*>/g, '');
  var playerId = crypto.randomUUID();
  createPlayer(playerId, safeName, req.userId);
  res.json({ playerId: playerId });
});

// PUT /api/characters — upload/update build (JWT required)
router.put('/characters', requireAuth, function (req, res) {
  var player = getPlayerByUserId(req.userId);
  if (!player) return res.status(404).json({ error: 'No arena player linked to this account. Register first.' });
  var playerId = player.id;

  // Rate limit: 10 uploads per player per hour
  if (!buildLimiter.check(playerId)) {
    return res.status(429).json({ error: 'Too many build uploads. Try again later.' });
  }

  var build = req.body;
  if (!build || typeof build !== 'object') {
    return res.status(400).json({ error: 'Invalid build data' });
  }

  // Validate name
  if (typeof build.name !== 'string' || build.name.length < 1 || build.name.length > 20) {
    return res.status(400).json({ error: 'Invalid name (1-20 chars)' });
  }
  build.name = build.name.replace(/<[^>]*>/g, '');

  // Validate sprite
  if (VALID_SPRITES.indexOf(build.sprite) === -1) {
    return res.status(400).json({ error: 'Invalid sprite' });
  }

  // Validate rangeType
  if (VALID_RANGE_TYPES.indexOf(build.rangeType) === -1) {
    build.rangeType = 'melee';
  }

  // Validate skills (array of 2, each null or integer 0-18)
  if (!Array.isArray(build.skills) || build.skills.length !== 2) {
    return res.status(400).json({ error: 'Invalid skills array' });
  }
  for (var si = 0; si < 2; si++) {
    if (build.skills[si] !== null) {
      var sv = parseInt(build.skills[si]);
      if (isNaN(sv) || sv < 0 || sv > 18) {
        return res.status(400).json({ error: 'Invalid skill index: ' + build.skills[si] });
      }
      build.skills[si] = sv;
    }
  }

  // Validate ultimate (null or integer 0-7)
  if (build.ultimate !== null) {
    var uv = parseInt(build.ultimate);
    if (isNaN(uv) || uv < 0 || uv > 7) {
      return res.status(400).json({ error: 'Invalid ultimate index' });
    }
    build.ultimate = uv;
  }

  // Validate equipment slots and baseKeys
  if (build.equipment && typeof build.equipment === 'object') {
    for (var ek in build.equipment) {
      if (VALID_EQUIP_SLOTS.indexOf(ek) === -1) {
        delete build.equipment[ek];
        continue;
      }
      var item = build.equipment[ek];
      if (item) {
        // Get baseKey from string or object form
        var baseKey = typeof item === 'string' ? item : (item && item.baseKey);
        if (baseKey && !VALID_BASE_KEYS.has(baseKey)) {
          delete build.equipment[ek]; // Strip invalid equipment
        }
      }
    }
  }

  // Validate stat caps (sanity check — client recomputes on load anyway)
  if (build.stats && typeof build.stats === 'object') {
    for (var cap in UPLOAD_STAT_CAPS) {
      if (typeof build.stats[cap] === 'number' && build.stats[cap] > UPLOAD_STAT_CAPS[cap]) {
        return res.status(400).json({ error: 'Stat ' + cap + ' exceeds maximum (' + UPLOAD_STAT_CAPS[cap] + ')' });
      }
    }
  }

  // Tag with build version
  build._v = 1;

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

// POST /api/battles/start — request a battle token (JWT required)
router.post('/battles/start', requireAuth, function (req, res) {
  var player = getPlayerByUserId(req.userId);
  if (!player) return res.status(404).json({ error: 'No arena player linked to this account' });

  var defenderId = req.body.defenderId;
  if (!defenderId) return res.status(400).json({ error: 'Missing defenderId' });

  var defender = getPlayer(defenderId);
  if (!defender) return res.status(404).json({ error: 'Defender not found' });

  var defenderBuild = getBuild(defenderId);
  if (!defenderBuild) return res.status(400).json({ error: 'Defender has no build' });

  var battleToken = crypto.randomUUID();
  createPendingBattle(player.id, defenderId, battleToken);
  res.json({ battleToken: battleToken });
});

// POST /api/battles — report result (JWT required, battle token required)
router.post('/battles', requireAuth, function (req, res) {
  var player = getPlayerByUserId(req.userId);
  if (!player) return res.status(404).json({ error: 'No arena player linked to this account' });

  var { battleToken, challengerWon } = req.body;
  if (!battleToken) {
    return res.status(400).json({ error: 'Missing battle token' });
  }

  // Consume the pending battle token
  var pending = consumePendingBattle(battleToken, player.id);
  if (!pending) {
    return res.status(403).json({ error: 'Invalid or expired battle token' });
  }

  // Check token age (< 10 minutes)
  var tokenAge = (Date.now() - new Date(pending.created_at + 'Z').getTime()) / 1000;
  if (tokenAge > 600) {
    return res.status(403).json({ error: 'Battle token expired (>10 minutes)' });
  }

  // Dedup check: no two battles between same pair within 30 seconds
  if (recentBattleExists(pending.challenger_id, pending.defender_id, 30)) {
    return res.status(409).json({ error: 'Duplicate battle report' });
  }

  reportBattle(pending.challenger_id, pending.defender_id, challengerWon);
  res.json({ ok: true });
});

// POST /api/stats — sync local stats to server (JWT required)
router.post('/stats', requireAuth, function (req, res) {
  var player = getPlayerByUserId(req.userId);
  if (!player) return res.status(404).json({ error: 'No arena player linked to this account' });
  updateStats(player.id, req.body.ladderBest || 0, req.body.dungeonClears || 0);
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

// =============== BUG REPORTS ===============

var VALID_CATEGORIES = ['gameplay', 'ui', 'crash', 'balance', 'network', 'other'];

// POST /api/bugs — submit bug report (no auth required)
router.post('/bugs', function (req, res) {
  // Rate limit: 5 per IP per hour
  var ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (!bugLimiter.check(ip)) {
    return res.status(429).json({ error: 'Too many bug reports. Try again later.' });
  }

  var { category, description, diagnostic_data, screenshot_data, player_id, player_name } = req.body;

  // Validate category
  category = category || 'other';
  if (VALID_CATEGORIES.indexOf(category) === -1) {
    return res.status(400).json({ error: 'Invalid category. Valid: ' + VALID_CATEGORIES.join(', ') });
  }

  // Validate description
  if (!description || typeof description !== 'string' || description.trim().length < 10) {
    return res.status(400).json({ error: 'Description must be at least 10 characters.' });
  }
  if (description.length > 5000) {
    return res.status(400).json({ error: 'Description too long (max 5000 chars).' });
  }

  // Validate diagnostic_data size
  var diagStr = null;
  if (diagnostic_data) {
    diagStr = typeof diagnostic_data === 'string' ? diagnostic_data : JSON.stringify(diagnostic_data);
    if (diagStr.length > 102400) {
      return res.status(400).json({ error: 'Diagnostic data too large (max 100KB).' });
    }
  }

  // Validate screenshot size
  if (screenshot_data && screenshot_data.length > 512000) {
    return res.status(400).json({ error: 'Screenshot too large (max 500KB).' });
  }

  var id = createBugReport(
    player_id || null,
    player_name || 'Anonymous',
    category,
    description.trim(),
    diagStr,
    screenshot_data || null,
    req.headers['user-agent'] || null,
    req.body.game_version || null
  );

  res.json({ ok: true, id: id });
});

export default router;
