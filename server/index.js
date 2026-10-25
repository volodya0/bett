import express from 'express';
import cookieSession from 'cookie-session';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, getSettings, saveSettings, DEFAULT_SETTINGS, tx } from './db.js';
import { settle } from './scoring.js';
import { translate } from './messages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const VERSION = process.env.APP_VERSION || 'dev';
const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Session secret: from env, or generated once and stored next to the DB
// so restarts don't log everyone out.
function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(process.env.DATA_DIR || path.resolve('data'), '.session-secret');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'));
  return fs.readFileSync(file, 'utf8').trim();
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));
app.use(
  cookieSession({
    name: 'kumbet',
    secret: sessionSecret(),
    maxAge: 60 * 24 * 3600 * 1000,
    sameSite: 'lax',
    httpOnly: true,
  })
);

const langOf = (req) => (req.get('x-lang') === 'en' ? 'en' : 'uk');

// ---------- helpers ----------

class HttpError extends Error {
  constructor(status, key, params) {
    super(key);
    this.status = status;
    this.key = key;
    this.params = params;
  }
}
const fail = (status, key, params) => {
  throw new HttpError(status, key, params);
};
const wrap = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res);
    if (out !== undefined) res.json(out);
  } catch (e) {
    next(e);
  }
};

// CSRF protection: mutations only via JSON requests (a cross-site form can't send those).
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && !req.is('application/json')) return next(new HttpError(415, 'jsonExpected'));
  next();
});

const toCents = (points) => Math.round(Number(points) * 100);
// Rating only counts settled matches: a stake on a match that is still open
// is not subtracted until the result is in.
const SETTLED = `NOT (t.kind = 'stake' AND t.match_id IN (SELECT id FROM matches WHERE status = 'open'))`;
const balanceOf = (userId) =>
  db.prepare(`SELECT COALESCE(SUM(t.amount), 0) AS b FROM transactions t WHERE t.user_id = ? AND ${SETTLED}`).get(userId).b;
const isLocked = (m) => m.status !== 'open' || Date.now() >= Date.parse(m.kickoff);

// ---------- activity log ----------

const LOG_DAYS = 30;
const insertLog = db.prepare('INSERT INTO activity (user_id, action, detail) VALUES (?, ?, ?)');
function logEvent(userId, action, detail = '') {
  try {
    insertLog.run(userId ?? null, action, String(detail).slice(0, 200));
  } catch (e) {
    console.error('log failed', e);
  }
}
const pruneLogs = () => db.prepare(`DELETE FROM activity WHERE created_at < datetime('now', '-${LOG_DAYS} days')`).run();
pruneLogs();
setInterval(pruneLogs, 6 * 3600 * 1000).unref();

const matchLabel = (m) => `${m.home} — ${m.away}`;

function currentUser(req) {
  if (!req.session?.uid) return null;
  return db.prepare('SELECT id, username, is_admin, approved FROM users WHERE id = ?').get(req.session.uid) || null;
}
function requireUser(req) {
  const u = currentUser(req);
  if (!u) fail(401, 'loginRequired');
  if (!u.approved) fail(403, 'pendingApproval');
  return u;
}
function requireAdmin(req) {
  const u = requireUser(req);
  if (!u.is_admin) fail(403, 'adminOnly');
  return u;
}
function getMatch(id) {
  const m = db.prepare('SELECT * FROM matches WHERE id = ?').get(Number(id));
  if (!m) fail(404, 'matchNotFound');
  return m;
}
function parseScore(v) {
  const n = Number(v);
  if (v === '' || v === null || !Number.isInteger(n) || n < 0 || n > 99) fail(400, 'badScore');
  return n;
}
function publicMatch(m) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM predictions WHERE match_id = ?').get(m.id).c;
  const comments = db.prepare('SELECT COUNT(*) AS c FROM comments WHERE match_id = ?').get(m.id).c;
  return {
    id: m.id,
    home: m.home,
    away: m.away,
    tournament: m.tournament,
    kickoff: m.kickoff,
    stake: m.stake,
    bonus: m.bonus,
    status: m.status,
    homeScore: m.home_score,
    awayScore: m.away_score,
    locked: isLocked(m),
    participants: count,
    pot: m.stake * count + m.bonus,
    comments,
  };
}

// Used by the post-deploy health check.
app.get('/api/health', (req, res) => {
  db.prepare('SELECT 1').get();
  res.json({ ok: true, version: VERSION });
});

// ---------- auth ----------

app.get(
  '/api/me',
  wrap((req) => {
    const u = currentUser(req);
    const s = getSettings();
    return {
      user: u && {
        id: u.id,
        username: u.username,
        isAdmin: !!u.is_admin,
        approved: !!u.approved,
        balance: balanceOf(u.id),
      },
      pendingCount: u?.is_admin ? db.prepare('SELECT COUNT(*) AS c FROM users WHERE approved = 0').get().c : 0,
      siteName: s.siteName,
      version: VERSION,
      inviteRequired: !!s.inviteCode,
    };
  })
);

app.post(
  '/api/register',
  wrap((req) => {
    const s = getSettings();
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!/^[\p{L}\p{N}_.\-]{2,24}$/u.test(username)) fail(400, 'badUsername');
    if (password.length < 4) fail(400, 'shortPassword');
    if (s.inviteCode && String(req.body.inviteCode || '').trim() !== s.inviteCode) fail(403, 'badInvite');
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) fail(409, 'usernameTaken');

    const isFirst = db.prepare('SELECT COUNT(*) AS c FROM users').get().c === 0;
    const isAdmin = isFirst || ADMIN_USERNAMES.includes(username.toLowerCase());
    const approved = isAdmin || !s.requireApproval;
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (username, password_hash, is_admin, approved) VALUES (?, ?, ?, ?)')
      .run(username, bcrypt.hashSync(password, 10), isAdmin ? 1 : 0, approved ? 1 : 0);
    req.session.uid = Number(lastInsertRowid);
    logEvent(req.session.uid, 'register', approved ? '' : 'pending');
    return { ok: true };
  })
);

app.post(
  '/api/login',
  wrap((req) => {
    const u = db.prepare('SELECT * FROM users WHERE username = ?').get(String(req.body.username || '').trim());
    if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.password_hash)) fail(401, 'badCredentials');
    req.session.uid = u.id;
    logEvent(u.id, 'login');
    return { ok: true };
  })
);

app.post(
  '/api/logout',
  wrap((req) => {
    if (req.session?.uid) logEvent(req.session.uid, 'logout');
    req.session = null;
    return { ok: true };
  })
);

// ---------- matches & predictions ----------

// Full match view for a user: before kickoff others' predictions are hidden —
// everyone sees WHO is in, but not WHAT they predicted.
function matchView(m, u) {
  const locked = isLocked(m);
  const preds = db
    .prepare(
      `SELECT p.user_id, u.username, p.home, p.away, p.tier, p.payout
       FROM predictions p JOIN users u ON u.id = p.user_id
       WHERE p.match_id = ? ORDER BY p.created_at`
    )
    .all(m.id);
  const people = preds.map((p) =>
    locked || p.user_id === u.id
      ? { username: p.username, home: p.home, away: p.away, tier: p.tier, payout: p.payout, me: p.user_id === u.id }
      : { username: p.username, hidden: true, me: false }
  );
  const my = preds.find((p) => p.user_id === u.id);
  return {
    ...publicMatch(m),
    people,
    my: my ? { home: my.home, away: my.away, tier: my.tier, payout: my.payout } : null,
  };
}

app.get(
  '/api/matches',
  wrap((req) => {
    const u = requireUser(req);
    return db
      .prepare('SELECT * FROM matches ORDER BY kickoff ASC')
      .all()
      .map((m) => matchView(m, u));
  })
);

app.get(
  '/api/matches/:id',
  wrap((req) => matchView(getMatch(req.params.id), requireUser(req)))
);

app.post(
  '/api/matches/:id/predict',
  wrap((req) => {
    const u = requireUser(req);
    const home = parseScore(req.body.home);
    const away = parseScore(req.body.away);
    return tx(() => {
      const m = getMatch(req.params.id);
      if (isLocked(m)) fail(409, 'betsClosed');
      const existing = db.prepare('SELECT id FROM predictions WHERE match_id = ? AND user_id = ?').get(m.id, u.id);
      if (existing) {
        db.prepare("UPDATE predictions SET home = ?, away = ?, updated_at = datetime('now') WHERE id = ?").run(
          home,
          away,
          existing.id
        );
        logEvent(u.id, 'bet_update', `${matchLabel(m)}: ${home}:${away}`);
      } else {
        db.prepare('INSERT INTO predictions (match_id, user_id, home, away) VALUES (?, ?, ?, ?)').run(m.id, u.id, home, away);
        db.prepare("INSERT INTO transactions (user_id, amount, kind, match_id) VALUES (?, ?, 'stake', ?)").run(
          u.id,
          -m.stake,
          m.id
        );
        logEvent(u.id, 'bet', `${matchLabel(m)}: ${home}:${away}`);
      }
      return { ok: true, balance: balanceOf(u.id) };
    });
  })
);

// Page views from the client. Repeats of the same page within a minute are skipped.
app.post(
  '/api/log',
  wrap((req) => {
    const u = currentUser(req);
    if (!u) return { ok: true };
    const page = String(req.body.page || '').slice(0, 60);
    const recent = db
      .prepare(
        `SELECT 1 FROM activity WHERE user_id = ? AND action = 'view' AND detail = ? AND created_at > datetime('now', '-1 minute')`
      )
      .get(u.id, page);
    if (!recent) logEvent(u.id, 'view', page);
    return { ok: true };
  })
);

// ---------- comments ----------

app.get(
  '/api/matches/:id/comments',
  wrap((req) => {
    const u = requireUser(req);
    const m = getMatch(req.params.id);
    return db
      .prepare(
        `SELECT c.id, c.text, c.created_at AS createdAt, u.username, c.user_id = ? AS mine
         FROM comments c JOIN users u ON u.id = c.user_id
         WHERE c.match_id = ? ORDER BY c.id`
      )
      .all(u.id, m.id)
      .map((c) => ({ ...c, mine: !!c.mine }));
  })
);

app.post(
  '/api/matches/:id/comments',
  wrap((req) => {
    const u = requireUser(req);
    const m = getMatch(req.params.id);
    const text = String(req.body.text || '').trim();
    if (!text) fail(400, 'commentEmpty');
    if (text.length > 1000) fail(400, 'commentTooLong');
    db.prepare('INSERT INTO comments (match_id, user_id, text) VALUES (?, ?, ?)').run(m.id, u.id, text);
    logEvent(u.id, 'comment', `${matchLabel(m)}: ${text}`);
    return { ok: true };
  })
);

app.delete(
  '/api/comments/:id',
  wrap((req) => {
    const u = requireUser(req);
    const c = db.prepare('SELECT user_id FROM comments WHERE id = ?').get(Number(req.params.id));
    if (!c) fail(404, 'commentNotFound');
    if (c.user_id !== u.id && !u.is_admin) fail(403, 'cantDeleteComment');
    db.prepare('DELETE FROM comments WHERE id = ?').run(Number(req.params.id));
    return { ok: true };
  })
);

// ---------- leaderboard, history, rules ----------

app.get(
  '/api/leaderboard',
  wrap((req) => {
    requireUser(req);
    return db
      .prepare(
        `SELECT u.id, u.username,
           (SELECT COALESCE(SUM(t.amount),0) FROM transactions t WHERE t.user_id = u.id AND ${SETTLED}) AS balance,
           (SELECT COUNT(*) FROM predictions p WHERE p.user_id = u.id) AS bets,
           (SELECT COUNT(*) FROM predictions p WHERE p.user_id = u.id AND p.tier = 'exact') AS exact,
           (SELECT COUNT(*) FROM predictions p WHERE p.user_id = u.id AND p.payout > 0) AS hits
         FROM users u WHERE u.approved = 1 ORDER BY balance DESC, exact DESC, u.username`
      )
      .all();
  })
);

app.get(
  '/api/history',
  wrap((req) => {
    const u = requireUser(req);
    return db
      .prepare(
        `SELECT t.amount, t.kind, t.note, t.match_id AS matchId, t.created_at AS createdAt,
           m.home, m.away, m.home_score AS homeScore, m.away_score AS awayScore
         FROM transactions t LEFT JOIN matches m ON m.id = t.match_id
         WHERE t.user_id = ? AND ${SETTLED} ORDER BY t.id DESC`
      )
      .all(u.id);
  })
);

app.get(
  '/api/rules',
  wrap(() => {
    const s = getSettings();
    return { defaultStake: s.defaultStake, wExact: s.wExact, wDiff: s.wDiff, wOutcome: s.wOutcome, wNear: s.wNear };
  })
);

// ---------- admin ----------

app.get(
  '/api/admin/settings',
  wrap((req) => {
    requireAdmin(req);
    return getSettings();
  })
);

app.put(
  '/api/admin/settings',
  wrap((req) => {
    requireAdmin(req);
    const patch = {};
    for (const [k, def] of Object.entries(DEFAULT_SETTINGS)) {
      if (!(k in req.body)) continue;
      const v = req.body[k];
      if (typeof def === 'number') {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) fail(400, 'badValue', { field: k });
        patch[k] = n;
      } else if (typeof def === 'boolean') patch[k] = !!v;
      else patch[k] = String(v).trim();
    }
    saveSettings(patch);
    logEvent(req.session.uid, 'admin_settings');
    return getSettings();
  })
);

function readMatchBody(body, partial = false) {
  const out = {};
  for (const k of ['home', 'away', 'tournament']) {
    if (k in body) out[k] = String(body[k] ?? '').trim();
  }
  if (!partial && (!out.home || !out.away)) fail(400, 'teamsRequired');
  if ('kickoff' in body || !partial) {
    const raw = String(body.kickoff ?? '');
    // Without an explicit offset the time would be read in the server's zone (UTC).
    if (!/(Z|[+-]\d\d:?\d\d)$/i.test(raw)) fail(400, 'kickoffNeedsTz');
    const t = Date.parse(raw);
    if (Number.isNaN(t)) fail(400, 'badKickoff');
    out.kickoff = new Date(t).toISOString();
  }
  if ('stake' in body && body.stake !== '' && body.stake != null) {
    out.stake = toCents(body.stake);
    if (!(out.stake > 0)) fail(400, 'stakePositive');
  }
  if ('bonus' in body) {
    out.bonus = toCents(body.bonus || 0);
    if (!(out.bonus >= 0)) fail(400, 'bonusNegative');
  }
  return out;
}

function insertMatch(d) {
  const stake = d.stake ?? toCents(getSettings().defaultStake);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO matches (home, away, tournament, kickoff, stake, bonus) VALUES (?, ?, ?, ?, ?, ?)')
    .run(d.home, d.away, d.tournament || '', d.kickoff, stake, d.bonus || 0);
  return Number(lastInsertRowid);
}

app.post(
  '/api/admin/matches',
  wrap((req) => {
    requireAdmin(req);
    const d = readMatchBody(req.body);
    logEvent(req.session.uid, 'admin_match', matchLabel(d));
    return { id: insertMatch(d) };
  })
);

// Bulk add from JSON: a single match object or an array of them.
// Matches with the same teams and kickoff as an existing one are skipped.
app.post(
  '/api/admin/matches/import',
  wrap((req) => {
    requireAdmin(req);
    const lang = langOf(req);
    const input = req.body.matches ?? req.body;
    const list = Array.isArray(input) ? input : input && typeof input === 'object' ? [input] : [];
    if (!list.length || list.some((x) => !x || typeof x !== 'object')) fail(400, 'importEmpty');

    const parsed = list.map((item, i) => {
      try {
        return readMatchBody(item);
      } catch (e) {
        if (!(e instanceof HttpError)) throw e;
        fail(400, 'importItem', { n: i + 1, error: translate(lang, e.key, e.params) });
      }
    });
    return tx(() => {
      const exists = db.prepare('SELECT 1 FROM matches WHERE home = ? AND away = ? AND kickoff = ?');
      const created = [];
      let skipped = 0;
      for (const d of parsed) {
        if (exists.get(d.home, d.away, d.kickoff)) skipped++;
        else created.push(insertMatch(d));
      }
      logEvent(req.session.uid, 'admin_import', `${created.length} / ${parsed.length}`);
      return { created: created.length, skipped, ids: created };
    });
  })
);

app.put(
  '/api/admin/matches/:id',
  wrap((req) => {
    requireAdmin(req);
    const m = getMatch(req.params.id);
    if (m.status !== 'open') fail(409, 'reopenFirst');
    const d = readMatchBody(req.body, true);
    const hasBets = db.prepare('SELECT 1 FROM predictions WHERE match_id = ?').get(m.id);
    if (hasBets && d.stake !== undefined && d.stake !== m.stake) fail(409, 'stakeLocked');
    const next = { ...m, ...d };
    db.prepare('UPDATE matches SET home = ?, away = ?, tournament = ?, kickoff = ?, stake = ?, bonus = ? WHERE id = ?').run(
      next.home,
      next.away,
      next.tournament,
      next.kickoff,
      next.stake,
      next.bonus,
      m.id
    );
    return { ok: true };
  })
);

app.delete(
  '/api/admin/matches/:id',
  wrap((req) => {
    requireAdmin(req);
    const m = getMatch(req.params.id);
    if (db.prepare('SELECT 1 FROM predictions WHERE match_id = ?').get(m.id)) fail(409, 'hasBetsCancel');
    db.prepare('DELETE FROM matches WHERE id = ?').run(m.id);
    return { ok: true };
  })
);

// Record the final score and distribute the pot.
app.post(
  '/api/admin/matches/:id/result',
  wrap((req) => {
    requireAdmin(req);
    const actual = { home: parseScore(req.body.home), away: parseScore(req.body.away) };
    return tx(() => {
      const m = getMatch(req.params.id);
      if (m.status !== 'open') fail(409, 'matchClosed');
      if (Date.now() < Date.parse(m.kickoff) && !req.body.force) fail(409, 'notStarted');
      const predictions = db.prepare('SELECT id, user_id, home, away FROM predictions WHERE match_id = ?').all(m.id);
      const r = settle({ predictions, actual, stake: m.stake, bonus: m.bonus, settings: getSettings() });

      const updPred = db.prepare('UPDATE predictions SET tier = ?, payout = ? WHERE id = ?');
      const addTx = db.prepare("INSERT INTO transactions (user_id, amount, kind, match_id) VALUES (?, ?, 'payout', ?)");
      for (const row of r.rows) {
        updPred.run(row.tier, row.payout, row.id);
        if (row.payout) addTx.run(row.user_id, row.payout, m.id);
      }
      db.prepare("UPDATE matches SET status = 'finished', home_score = ?, away_score = ? WHERE id = ?").run(
        actual.home,
        actual.away,
        m.id
      );
      logEvent(req.session.uid, 'admin_result', `${matchLabel(m)} ${actual.home}:${actual.away}`);
      return { ok: true, pot: r.pot };
    });
  })
);

// Cancel a match — all stakes are refunded.
app.post(
  '/api/admin/matches/:id/cancel',
  wrap((req) => {
    requireAdmin(req);
    return tx(() => {
      const m = getMatch(req.params.id);
      if (m.status !== 'open') fail(409, 'matchClosed');
      const preds = db.prepare('SELECT user_id FROM predictions WHERE match_id = ?').all(m.id);
      const addTx = db.prepare("INSERT INTO transactions (user_id, amount, kind, match_id) VALUES (?, ?, 'refund', ?)");
      for (const p of preds) addTx.run(p.user_id, m.stake, m.id);
      db.prepare("UPDATE matches SET status = 'cancelled' WHERE id = ?").run(m.id);
      logEvent(req.session.uid, 'admin_cancel', matchLabel(m));
      return { ok: true };
    });
  })
);

// Roll back a result/cancellation (e.g. wrong score entered).
app.post(
  '/api/admin/matches/:id/reopen',
  wrap((req) => {
    requireAdmin(req);
    return tx(() => {
      const m = getMatch(req.params.id);
      if (m.status === 'open') fail(409, 'alreadyOpen');
      db.prepare("DELETE FROM transactions WHERE match_id = ? AND kind IN ('payout', 'refund')").run(m.id);
      db.prepare('UPDATE predictions SET tier = NULL, payout = NULL WHERE match_id = ?').run(m.id);
      db.prepare("UPDATE matches SET status = 'open', home_score = NULL, away_score = NULL WHERE id = ?").run(m.id);
      logEvent(req.session.uid, 'admin_reopen', matchLabel(m));
      return { ok: true };
    });
  })
);

app.get(
  '/api/admin/users',
  wrap((req) => {
    requireAdmin(req);
    return db
      .prepare(
        `SELECT u.id, u.username, u.is_admin AS isAdmin, u.approved, u.created_at AS createdAt,
           (SELECT COALESCE(SUM(t.amount),0) FROM transactions t WHERE t.user_id = u.id AND ${SETTLED}) AS balance
         FROM users u ORDER BY u.approved, u.username`
      )
      .all();
  })
);

app.post(
  '/api/admin/users/:id/adjust',
  wrap((req) => {
    requireAdmin(req);
    const amount = toCents(req.body.amount);
    if (!amount) fail(400, 'amountRequired');
    db.prepare("INSERT INTO transactions (user_id, amount, kind, note) VALUES (?, ?, 'admin', ?)").run(
      Number(req.params.id),
      amount,
      String(req.body.note || '').trim()
    );
    logEvent(
      req.session.uid,
      'admin_adjust',
      `${db.prepare('SELECT username FROM users WHERE id = ?').get(Number(req.params.id))?.username}: ${amount / 100}`
    );
    return { ok: true };
  })
);

app.post(
  '/api/admin/users/:id/approve',
  wrap((req) => {
    requireAdmin(req);
    db.prepare('UPDATE users SET approved = 1 WHERE id = ?').run(Number(req.params.id));
    logEvent(req.session.uid, 'admin_approve', db.prepare('SELECT username FROM users WHERE id = ?').get(Number(req.params.id))?.username);
    return { ok: true };
  })
);

// Reject a sign-up (or remove a player who never bet).
app.delete(
  '/api/admin/users/:id',
  wrap((req) => {
    const me = requireAdmin(req);
    const id = Number(req.params.id);
    if (id === me.id) fail(400, 'cantUnadminSelf');
    if (db.prepare('SELECT 1 FROM transactions WHERE user_id = ?').get(id)) fail(409, 'cantDeleteUser');
    logEvent(me.id, 'admin_reject', db.prepare('SELECT username FROM users WHERE id = ?').get(id)?.username);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return { ok: true };
  })
);

app.post(
  '/api/admin/users/:id/admin',
  wrap((req) => {
    const me = requireAdmin(req);
    if (Number(req.params.id) === me.id && !req.body.isAdmin) fail(400, 'cantUnadminSelf');
    db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(req.body.isAdmin ? 1 : 0, Number(req.params.id));
    return { ok: true };
  })
);

app.post(
  '/api/admin/users/:id/password',
  wrap((req) => {
    requireAdmin(req);
    const password = String(req.body.password || '');
    if (password.length < 4) fail(400, 'shortPassword');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), Number(req.params.id));
    return { ok: true };
  })
);

app.get(
  '/api/admin/logs',
  wrap((req) => {
    requireAdmin(req);
    const userId = Number(req.query.user) || null;
    const limit = Math.min(1000, Number(req.query.limit) || 300);
    return db
      .prepare(
        `SELECT a.id, a.action, a.detail, a.created_at AS createdAt, u.username
         FROM activity a LEFT JOIN users u ON u.id = a.user_id
         WHERE (? IS NULL OR a.user_id = ?)
         ORDER BY a.id DESC LIMIT ?`
      )
      .all(userId, userId, limit);
  })
);

// Full data dump for backups or a quick look (password hashes excluded).
app.get(
  '/api/admin/export',
  wrap((req, res) => {
    requireAdmin(req);
    const dump = {
      exportedAt: new Date().toISOString(),
      version: VERSION,
      settings: getSettings(),
      users: db.prepare('SELECT id, username, is_admin, created_at FROM users ORDER BY id').all(),
      matches: db.prepare('SELECT * FROM matches ORDER BY id').all(),
      predictions: db.prepare('SELECT * FROM predictions ORDER BY id').all(),
      transactions: db.prepare('SELECT * FROM transactions ORDER BY id').all(),
      comments: db.prepare('SELECT * FROM comments ORDER BY id').all(),
      activity: db.prepare('SELECT * FROM activity ORDER BY id').all(),
    };
    const date = dump.exportedAt.slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="bett-${date}.json"`);
    res.type('application/json').send(JSON.stringify(dump, null, 2));
  })
);

app.use('/api', (req, res, next) => next(new HttpError(404, 'notFound')));

// ---------- frontend ----------

const dist = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, _next) => {
  const lang = langOf(req);
  if (err instanceof HttpError) return res.status(err.status).json({ error: translate(lang, err.key, err.params) });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: translate(lang, 'importEmpty') });
  console.error(err);
  res.status(500).json({ error: translate(lang, 'serverError') });
});

app.listen(PORT, () => console.log(`⚽ Kumbet: http://localhost:${PORT}`));
