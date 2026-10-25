// SQLite is built into Node.js 22+ — no separate database server.
// The whole database is one file in DATA_DIR (default ./data/kumbet.db).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = process.env.DATA_DIR || path.resolve('data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(process.env.DB_FILE || path.join(dataDir, 'kumbet.db'));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- All amounts are in "cents" (1 point = 100) to avoid rounding issues.
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY,
  home TEXT NOT NULL,
  away TEXT NOT NULL,
  tournament TEXT NOT NULL DEFAULT '',
  kickoff TEXT NOT NULL,              -- ISO string, UTC
  stake INTEGER NOT NULL,             -- stake per participant
  bonus INTEGER NOT NULL DEFAULT 0,   -- admin bonus added to the match pot
  status TEXT NOT NULL DEFAULT 'open', -- open | finished | cancelled
  home_score INTEGER,
  away_score INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  home INTEGER NOT NULL,
  away INTEGER NOT NULL,
  tier TEXT,
  payout INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (match_id, user_id)
);

-- Ledger: a user's balance is the sum of their rows.
-- kind: stake | payout | refund | admin
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  kind TEXT NOT NULL,
  match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS comments_match ON comments(match_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Migration: no starting balances and no jackpot anymore — everyone starts at 0.
DELETE FROM transactions WHERE kind IN ('start', 'jackpot');
DROP TABLE IF EXISTS jackpot;
DELETE FROM settings WHERE key IN ('startingBalance', 'noWinnerPolicy', 'allowDebt');
`);

// Migration: approval flag on users (existing users count as approved).
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'approved')) {
  db.exec('ALTER TABLE users ADD COLUMN approved INTEGER NOT NULL DEFAULT 1');
}

export const DEFAULT_SETTINGS = {
  siteName: 'Кумівський тоталізатор',
  defaultStake: 1,       // default stake for new matches
  wExact: 10,            // weight for the exact score
  wDiff: 4,              // right winner and goal difference (2:1 vs 3:2, 1:1 vs 2:2)
  wOutcome: 2,           // right outcome only (home / draw / away)
  wNear: 1,              // wrong outcome, but off by a single goal
  inviteCode: '',        // if set, required to register
  requireApproval: false, // new sign-ups must be approved by an admin
};

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key in s) s[r.key] = JSON.parse(r.value);
  }
  return s;
}

export function saveSettings(patch) {
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  for (const [k, v] of Object.entries(patch)) {
    if (k in DEFAULT_SETTINGS) stmt.run(k, JSON.stringify(v));
  }
}

export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
