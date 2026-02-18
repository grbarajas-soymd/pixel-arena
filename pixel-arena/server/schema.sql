-- User accounts (for cloud saves + auth)
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cloud saves (full v4 save wrapper)
CREATE TABLE IF NOT EXISTS saves (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  save_json     TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Arena players
CREATE TABLE IF NOT EXISTS players (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Character builds (one per player)
CREATE TABLE IF NOT EXISTS builds (
  player_id     TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  build_json    TEXT NOT NULL,
  uploaded_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Win/loss records
CREATE TABLE IF NOT EXISTS records (
  player_id     TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0
);

-- Progression stats
CREATE TABLE IF NOT EXISTS stats (
  player_id     TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  ladder_best   INTEGER NOT NULL DEFAULT 0,
  dungeon_clears INTEGER NOT NULL DEFAULT 0,
  arena_rating  INTEGER NOT NULL DEFAULT 1000
);

-- Battle history
CREATE TABLE IF NOT EXISTS battles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  challenger_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  defender_id     TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  challenger_won  INTEGER NOT NULL,
  fought_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Bug reports
CREATE TABLE IF NOT EXISTS bug_reports (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id       TEXT REFERENCES players(id) ON DELETE SET NULL,
  player_name     TEXT NOT NULL DEFAULT 'Anonymous',
  category        TEXT NOT NULL DEFAULT 'other',
  description     TEXT NOT NULL,
  diagnostic_data TEXT,
  screenshot_data TEXT,
  browser_info    TEXT,
  game_version    TEXT,
  status          TEXT NOT NULL DEFAULT 'open',
  admin_notes     TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pending battles (battle token system)
CREATE TABLE IF NOT EXISTS pending_battles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  challenger_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  defender_id     TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token           TEXT UNIQUE NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_records_wins ON records(wins DESC);
CREATE INDEX IF NOT EXISTS idx_stats_ladder ON stats(ladder_best DESC);
CREATE INDEX IF NOT EXISTS idx_stats_dungeon ON stats(dungeon_clears DESC);
CREATE INDEX IF NOT EXISTS idx_stats_rating ON stats(arena_rating);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created ON bug_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_battles_token ON pending_battles(token);
CREATE INDEX IF NOT EXISTS idx_pending_battles_challenger ON pending_battles(challenger_id);
