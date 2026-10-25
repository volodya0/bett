// SQLite вбудований у Node.js 22+ — жодних окремих серверів БД.
// Уся база — один файл у DATA_DIR (за замовчуванням ./data/kumbet.db).
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

-- Суми скрізь у "центах" (1 бал = 100), щоб не мати проблем з округленням.
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY,
  home TEXT NOT NULL,
  away TEXT NOT NULL,
  tournament TEXT NOT NULL DEFAULT '',
  kickoff TEXT NOT NULL,              -- ISO-рядок у UTC
  stake INTEGER NOT NULL,             -- ставка з кожного учасника
  bonus INTEGER NOT NULL DEFAULT 0,   -- бонус від адміна в банк матчу
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

-- Журнал операцій: баланс = сума всіх записів користувача.
-- kind: start | stake | payout | refund | jackpot | admin
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  kind TEXT NOT NULL,
  match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Джекпот: банки матчів, де ніхто нічого не вгадав.
CREATE TABLE IF NOT EXISTS jackpot (
  id INTEGER PRIMARY KEY,
  amount INTEGER NOT NULL,
  match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

export const DEFAULT_SETTINGS = {
  siteName: 'Кумівський тоталізатор',
  startingBalance: 10,   // бали при реєстрації
  defaultStake: 1,       // ставка за замовчуванням для нового матчу
  wExact: 10,            // вага за точний рахунок
  wDiff: 4,              // вгадав переможця і різницю (2:1 vs 3:2, 1:1 vs 2:2)
  wOutcome: 2,           // вгадав лише результат (П1 / нічия / П2)
  wNear: 1,              // не вгадав результат, але промахнувся лише на 1 гол
  noWinnerPolicy: 'jackpot', // jackpot | refund
  inviteCode: '',        // якщо не порожній — потрібен для реєстрації
  allowDebt: false,      // чи можна ставити з нульовим балансом
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
