import express from 'express';
import cookieSession from 'cookie-session';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, getSettings, saveSettings, DEFAULT_SETTINGS, tx } from './db.js';
import { settle } from './scoring.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const VERSION = process.env.APP_VERSION || 'dev';
const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Секрет сесій: зі змінної середовища або згенерований і збережений поруч із БД,
// щоб після перезапуску нікого не розлогінювало.
function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(process.env.DATA_DIR || path.resolve('data'), '.session-secret');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'));
  return fs.readFileSync(file, 'utf8').trim();
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(
  cookieSession({
    name: 'kumbet',
    secret: sessionSecret(),
    maxAge: 60 * 24 * 3600 * 1000,
    sameSite: 'lax',
    httpOnly: true,
  })
);

// Захист від CSRF: змінювати дані можна лише JSON-запитами (крос-сайтова форма так не вміє).
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && !req.is('application/json')) {
    return res.status(415).json({ error: 'Очікується JSON' });
  }
  next();
});

// ---------- helpers ----------

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};
const wrap = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res);
    if (out !== undefined) res.json(out);
  } catch (e) {
    next(e);
  }
};

const toCents = (points) => Math.round(Number(points) * 100);
const balanceOf = (userId) =>
  db.prepare('SELECT COALESCE(SUM(amount), 0) AS b FROM transactions WHERE user_id = ?').get(userId).b;
const jackpotBalance = () => db.prepare('SELECT COALESCE(SUM(amount), 0) AS j FROM jackpot').get().j;
const isLocked = (m) => m.status !== 'open' || Date.now() >= Date.parse(m.kickoff);

function currentUser(req) {
  if (!req.session?.uid) return null;
  return db.prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(req.session.uid) || null;
}
function requireUser(req) {
  const u = currentUser(req);
  if (!u) fail(401, 'Спочатку увійдіть');
  return u;
}
function requireAdmin(req) {
  const u = requireUser(req);
  if (!u.is_admin) fail(403, 'Тільки для адміна');
  return u;
}
function getMatch(id) {
  const m = db.prepare('SELECT * FROM matches WHERE id = ?').get(Number(id));
  if (!m) fail(404, 'Матч не знайдено');
  return m;
}
function parseScore(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 99) fail(400, 'Рахунок — ціле число від 0 до 99');
  return n;
}
function publicMatch(m) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM predictions WHERE match_id = ?').get(m.id).c;
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
  };
}

// Для перевірки після деплою.
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
      user: u && { id: u.id, username: u.username, isAdmin: !!u.is_admin, balance: balanceOf(u.id) },
      siteName: s.siteName,
      version: VERSION,
      inviteRequired: !!s.inviteCode,
      jackpot: jackpotBalance(),
    };
  })
);

app.post(
  '/api/register',
  wrap((req) => {
    const s = getSettings();
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!/^[\p{L}\p{N}_.\-]{2,24}$/u.test(username))
      fail(400, 'Логін: 2–24 символи, літери/цифри/._-');
    if (password.length < 4) fail(400, 'Пароль — мінімум 4 символи');
    if (s.inviteCode && String(req.body.inviteCode || '').trim() !== s.inviteCode)
      fail(403, 'Невірний код запрошення');
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) fail(409, 'Такий логін уже зайнятий');

    const isFirst = db.prepare('SELECT COUNT(*) AS c FROM users').get().c === 0;
    const isAdmin = isFirst || ADMIN_USERNAMES.includes(username.toLowerCase());
    const id = tx(() => {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)')
        .run(username, bcrypt.hashSync(password, 10), isAdmin ? 1 : 0);
      const start = toCents(s.startingBalance);
      if (start)
        db.prepare("INSERT INTO transactions (user_id, amount, kind, note) VALUES (?, ?, 'start', 'Стартові бали')").run(
          lastInsertRowid,
          start
        );
      return Number(lastInsertRowid);
    });
    req.session.uid = id;
    return { ok: true };
  })
);

app.post(
  '/api/login',
  wrap((req) => {
    const u = db.prepare('SELECT * FROM users WHERE username = ?').get(String(req.body.username || '').trim());
    if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.password_hash))
      fail(401, 'Невірний логін або пароль');
    req.session.uid = u.id;
    return { ok: true };
  })
);

app.post(
  '/api/logout',
  wrap((req) => {
    req.session = null;
    return { ok: true };
  })
);

// ---------- matches & predictions ----------

app.get(
  '/api/matches',
  wrap((req) => {
    const u = requireUser(req);
    const mine = new Map(
      db
        .prepare('SELECT match_id, home, away, payout, tier FROM predictions WHERE user_id = ?')
        .all(u.id)
        .map((p) => [p.match_id, p])
    );
    return db
      .prepare('SELECT * FROM matches ORDER BY kickoff ASC')
      .all()
      .map((m) => {
        const p = mine.get(m.id);
        return { ...publicMatch(m), my: p ? { home: p.home, away: p.away, payout: p.payout, tier: p.tier } : null };
      });
  })
);

app.get(
  '/api/matches/:id',
  wrap((req) => {
    const u = requireUser(req);
    const m = getMatch(req.params.id);
    const locked = isLocked(m);
    const preds = db
      .prepare(
        `SELECT p.user_id, u.username, p.home, p.away, p.tier, p.payout, p.created_at
         FROM predictions p JOIN users u ON u.id = p.user_id
         WHERE p.match_id = ? ORDER BY p.created_at`
      )
      .all(m.id);
    // До початку матчу видно лише ХТО в грі, але не ЩО поставили.
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
  })
);

app.post(
  '/api/matches/:id/predict',
  wrap((req) => {
    const u = requireUser(req);
    const home = parseScore(req.body.home);
    const away = parseScore(req.body.away);
    return tx(() => {
      const m = getMatch(req.params.id);
      if (isLocked(m)) fail(409, 'Матч уже почався — ставки закрито');
      const existing = db.prepare('SELECT id FROM predictions WHERE match_id = ? AND user_id = ?').get(m.id, u.id);
      if (existing) {
        db.prepare("UPDATE predictions SET home = ?, away = ?, updated_at = datetime('now') WHERE id = ?").run(
          home,
          away,
          existing.id
        );
      } else {
        const s = getSettings();
        if (!s.allowDebt && balanceOf(u.id) < m.stake) fail(402, 'Недостатньо балів для ставки');
        db.prepare('INSERT INTO predictions (match_id, user_id, home, away) VALUES (?, ?, ?, ?)').run(
          m.id,
          u.id,
          home,
          away
        );
        db.prepare("INSERT INTO transactions (user_id, amount, kind, match_id, note) VALUES (?, ?, 'stake', ?, ?)").run(
          u.id,
          -m.stake,
          m.id,
          `Ставка: ${m.home} — ${m.away}`
        );
      }
      return { ok: true, balance: balanceOf(u.id) };
    });
  })
);

app.delete(
  '/api/matches/:id/predict',
  wrap((req) => {
    const u = requireUser(req);
    return tx(() => {
      const m = getMatch(req.params.id);
      if (isLocked(m)) fail(409, 'Матч уже почався — ставку не забрати');
      db.prepare('DELETE FROM predictions WHERE match_id = ? AND user_id = ?').run(m.id, u.id);
      db.prepare("DELETE FROM transactions WHERE match_id = ? AND user_id = ? AND kind = 'stake'").run(m.id, u.id);
      return { ok: true, balance: balanceOf(u.id) };
    });
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
           (SELECT COALESCE(SUM(amount),0) FROM transactions t WHERE t.user_id = u.id) AS balance,
           (SELECT COUNT(*) FROM predictions p WHERE p.user_id = u.id) AS bets,
           (SELECT COUNT(*) FROM predictions p WHERE p.user_id = u.id AND p.tier = 'exact') AS exact,
           (SELECT COUNT(*) FROM predictions p WHERE p.user_id = u.id AND p.payout > 0) AS hits
         FROM users u ORDER BY balance DESC, exact DESC, u.username`
      )
      .all();
  })
);

app.get(
  '/api/history',
  wrap((req) => {
    const u = requireUser(req);
    return db
      .prepare('SELECT amount, kind, note, match_id, created_at FROM transactions WHERE user_id = ? ORDER BY id DESC')
      .all(u.id);
  })
);

app.get(
  '/api/rules',
  wrap(() => {
    const s = getSettings();
    return {
      startingBalance: s.startingBalance,
      defaultStake: s.defaultStake,
      wExact: s.wExact,
      wDiff: s.wDiff,
      wOutcome: s.wOutcome,
      wNear: s.wNear,
      noWinnerPolicy: s.noWinnerPolicy,
      allowDebt: s.allowDebt,
      jackpot: jackpotBalance(),
    };
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
        if (!Number.isFinite(n) || n < 0) fail(400, `Невірне значення: ${k}`);
        patch[k] = n;
      } else if (typeof def === 'boolean') patch[k] = !!v;
      else patch[k] = String(v).trim();
    }
    if (patch.noWinnerPolicy && !['jackpot', 'refund'].includes(patch.noWinnerPolicy)) fail(400, 'Невірна політика');
    saveSettings(patch);
    return getSettings();
  })
);

function readMatchBody(body, partial = false) {
  const out = {};
  for (const k of ['home', 'away', 'tournament']) {
    if (k in body) out[k] = String(body[k] || '').trim();
  }
  if (!partial && (!out.home || !out.away)) fail(400, 'Вкажіть обидві команди');
  if ('kickoff' in body || !partial) {
    const t = Date.parse(body.kickoff);
    if (Number.isNaN(t)) fail(400, 'Невірний час початку');
    out.kickoff = new Date(t).toISOString();
  }
  if ('stake' in body) {
    out.stake = toCents(body.stake);
    if (!(out.stake > 0)) fail(400, 'Ставка має бути більшою за 0');
  }
  if ('bonus' in body) {
    out.bonus = toCents(body.bonus || 0);
    if (out.bonus < 0) fail(400, 'Бонус не може бути відʼємним');
  }
  return out;
}

app.post(
  '/api/admin/matches',
  wrap((req) => {
    requireAdmin(req);
    const d = readMatchBody(req.body);
    const stake = d.stake ?? toCents(getSettings().defaultStake);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO matches (home, away, tournament, kickoff, stake, bonus) VALUES (?, ?, ?, ?, ?, ?)')
      .run(d.home, d.away, d.tournament || '', d.kickoff, stake, d.bonus || 0);
    return { id: Number(lastInsertRowid) };
  })
);

app.put(
  '/api/admin/matches/:id',
  wrap((req) => {
    requireAdmin(req);
    const m = getMatch(req.params.id);
    if (m.status !== 'open') fail(409, 'Спершу відкрийте матч знову');
    const d = readMatchBody(req.body, true);
    const hasBets = db.prepare('SELECT 1 FROM predictions WHERE match_id = ?').get(m.id);
    if (hasBets && d.stake !== undefined && d.stake !== m.stake) fail(409, 'Ставки вже є — розмір ставки не змінити');
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
    if (db.prepare('SELECT 1 FROM predictions WHERE match_id = ?').get(m.id))
      fail(409, 'На матч уже є ставки — краще скасуйте його (бали повернуться)');
    db.prepare('DELETE FROM matches WHERE id = ?').run(m.id);
    return { ok: true };
  })
);

// Внести рахунок і розподілити банк.
app.post(
  '/api/admin/matches/:id/result',
  wrap((req) => {
    requireAdmin(req);
    const actual = { home: parseScore(req.body.home), away: parseScore(req.body.away) };
    return tx(() => {
      const m = getMatch(req.params.id);
      if (m.status !== 'open') fail(409, 'Матч уже закрито');
      if (Date.now() < Date.parse(m.kickoff) && !req.body.force)
        fail(409, 'Матч ще не почався. Точно внести результат?');
      const settings = getSettings();
      const predictions = db.prepare('SELECT id, user_id, home, away FROM predictions WHERE match_id = ?').all(m.id);
      const r = settle({ predictions, actual, stake: m.stake, bonus: m.bonus, jackpot: jackpotBalance(), settings });

      const label = `${m.home} ${actual.home}:${actual.away} ${m.away}`;
      const updPred = db.prepare('UPDATE predictions SET tier = ?, payout = ? WHERE id = ?');
      const addTx = db.prepare('INSERT INTO transactions (user_id, amount, kind, match_id, note) VALUES (?, ?, ?, ?, ?)');
      for (const row of r.rows) {
        updPred.run(row.tier, row.payout, row.id);
        if (row.payout) addTx.run(row.user_id, row.payout, 'payout', m.id, `Виграш: ${label}`);
        if (row.refund) addTx.run(row.user_id, row.refund, 'refund', m.id, `Повернення: ${label}`);
      }
      if (r.jackpotIn) db.prepare('INSERT INTO jackpot (amount, match_id, note) VALUES (?, ?, ?)').run(r.jackpotIn, m.id, `Ніхто не вгадав: ${label}`);
      if (r.jackpotOut) db.prepare('INSERT INTO jackpot (amount, match_id, note) VALUES (?, ?, ?)').run(-r.jackpotOut, m.id, `Джекпот зірвано: ${label}`);
      db.prepare("UPDATE matches SET status = 'finished', home_score = ?, away_score = ? WHERE id = ?").run(
        actual.home,
        actual.away,
        m.id
      );
      return { ok: true, pot: r.pot, jackpotIn: r.jackpotIn, jackpotOut: r.jackpotOut };
    });
  })
);

// Скасувати матч — усім повертаються ставки.
app.post(
  '/api/admin/matches/:id/cancel',
  wrap((req) => {
    requireAdmin(req);
    return tx(() => {
      const m = getMatch(req.params.id);
      if (m.status !== 'open') fail(409, 'Матч уже закрито');
      const preds = db.prepare('SELECT user_id FROM predictions WHERE match_id = ?').all(m.id);
      const addTx = db.prepare("INSERT INTO transactions (user_id, amount, kind, match_id, note) VALUES (?, ?, 'refund', ?, ?)");
      for (const p of preds) addTx.run(p.user_id, m.stake, m.id, `Матч скасовано: ${m.home} — ${m.away}`);
      db.prepare("UPDATE matches SET status = 'cancelled' WHERE id = ?").run(m.id);
      return { ok: true };
    });
  })
);

// Відкотити результат/скасування (якщо помилились з рахунком).
app.post(
  '/api/admin/matches/:id/reopen',
  wrap((req) => {
    requireAdmin(req);
    return tx(() => {
      const m = getMatch(req.params.id);
      if (m.status === 'open') fail(409, 'Матч і так відкритий');
      db.prepare("DELETE FROM transactions WHERE match_id = ? AND kind IN ('payout', 'refund')").run(m.id);
      db.prepare('DELETE FROM jackpot WHERE match_id = ?').run(m.id);
      db.prepare('UPDATE predictions SET tier = NULL, payout = NULL WHERE match_id = ?').run(m.id);
      db.prepare("UPDATE matches SET status = 'open', home_score = NULL, away_score = NULL WHERE id = ?").run(m.id);
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
        `SELECT u.id, u.username, u.is_admin AS isAdmin, u.created_at AS createdAt,
           (SELECT COALESCE(SUM(amount),0) FROM transactions t WHERE t.user_id = u.id) AS balance
         FROM users u ORDER BY u.username`
      )
      .all();
  })
);

app.post(
  '/api/admin/users/:id/adjust',
  wrap((req) => {
    requireAdmin(req);
    const amount = toCents(req.body.amount);
    if (!amount) fail(400, 'Вкажіть суму (можна відʼємну)');
    const note = String(req.body.note || '').trim() || (amount > 0 ? 'Подарунок від адміна' : 'Штраф від адміна');
    db.prepare("INSERT INTO transactions (user_id, amount, kind, note) VALUES (?, ?, 'admin', ?)").run(
      Number(req.params.id),
      amount,
      note
    );
    return { ok: true };
  })
);

app.post(
  '/api/admin/users/:id/admin',
  wrap((req) => {
    const me = requireAdmin(req);
    if (Number(req.params.id) === me.id && !req.body.isAdmin) fail(400, 'Не можна зняти адмінку з себе');
    db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(req.body.isAdmin ? 1 : 0, Number(req.params.id));
    return { ok: true };
  })
);

app.post(
  '/api/admin/users/:id/password',
  wrap((req) => {
    requireAdmin(req);
    const password = String(req.body.password || '');
    if (password.length < 4) fail(400, 'Пароль — мінімум 4 символи');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), Number(req.params.id));
    return { ok: true };
  })
);

app.post(
  '/api/admin/jackpot',
  wrap((req) => {
    requireAdmin(req);
    const amount = toCents(req.body.amount);
    if (!amount) fail(400, 'Вкажіть суму');
    db.prepare('INSERT INTO jackpot (amount, note) VALUES (?, ?)').run(amount, 'Коригування адміном');
    return { ok: true, jackpot: jackpotBalance() };
  })
);

app.use('/api', (req, res) => res.status(404).json({ error: 'VAR не знайшов такого ендпоінту' }));

// ---------- frontend ----------

const dist = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, _next) => {
  if (!(err instanceof HttpError)) console.error(err);
  res.status(err.status || 500).json({ error: err instanceof HttpError ? err.message : 'Щось зламалось 🙈' });
});

app.listen(PORT, () => console.log(`⚽ Kumbet: http://localhost:${PORT}`));
