import React, { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api, fmtDate, pts } from '../api.js';
import { useMe } from '../App.jsx';
import { toast } from '../eggs.js';

export default function Admin() {
  return (
    <div className="stack-lg">
      <nav className="subnav">
        <NavLink to="/admin" end>Матчі</NavLink>
        <NavLink to="/admin/users">Гравці</NavLink>
        <NavLink to="/admin/settings">Налаштування</NavLink>
      </nav>
      <Routes>
        <Route index element={<AdminMatches />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="settings" element={<AdminSettings />} />
      </Routes>
    </div>
  );
}

// datetime-local працює в локальному часі браузера → перетворюємо в/з ISO.
const toLocalInput = (iso) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const fromLocalInput = (v) => new Date(v).toISOString();

const run = async (fn, okMsg) => {
  try {
    await fn();
    if (okMsg) toast(okMsg);
    return true;
  } catch (e) {
    alert(e.message);
    return false;
  }
};

// ---------------- Матчі ----------------

function AdminMatches() {
  const { refresh } = useMe();
  const [matches, setMatches] = useState(null);
  const [editing, setEditing] = useState(null);
  const load = () => api.get('/api/matches').then(setMatches);
  useEffect(() => {
    load();
  }, []);
  const reload = () => {
    load();
    refresh();
  };

  if (!matches) return <div className="loading">⚽</div>;
  const open = matches.filter((m) => m.status === 'open');
  const closed = matches.filter((m) => m.status !== 'open').reverse();

  return (
    <>
      <MatchForm key={editing?.id || 'new'} match={editing} onDone={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />
      <section>
        <h2>Активні матчі</h2>
        {open.length === 0 && <p className="muted">Немає.</p>}
        <div className="stack">
          {open.map((m) => (
            <AdminMatchRow key={m.id} m={m} onEdit={() => { setEditing(m); window.scrollTo({ top: 0, behavior: 'smooth' }); }} onChange={reload} />
          ))}
        </div>
      </section>
      {closed.length > 0 && (
        <section>
          <h2>Закриті</h2>
          <div className="stack">
            {closed.map((m) => (
              <AdminMatchRow key={m.id} m={m} onChange={reload} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function MatchForm({ match, onDone, onCancel }) {
  const [f, setF] = useState(() =>
    match
      ? { home: match.home, away: match.away, tournament: match.tournament, kickoff: toLocalInput(match.kickoff), stake: match.stake / 100, bonus: match.bonus / 100 }
      : { home: '', away: '', tournament: '', kickoff: '', stake: '', bonus: 0 }
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const body = { ...f, kickoff: fromLocalInput(f.kickoff) };
    if (body.stake === '') delete body.stake;
    if (match && match.participants > 0) delete body.stake;
    const ok = await run(
      () => (match ? api.put(`/api/admin/matches/${match.id}`, body) : api.post('/api/admin/matches', body)),
      match ? 'Матч оновлено' : 'Матч додано ⚽'
    );
    if (ok) {
      if (!match) setF({ ...f, home: '', away: '' });
      onDone();
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>{match ? `Редагувати: ${match.home} — ${match.away}` : 'Новий матч'}</h2>
      <div className="form-grid">
        <label>Господарі<input value={f.home} onChange={set('home')} required placeholder="Динамо Київ" /></label>
        <label>Гості<input value={f.away} onChange={set('away')} required placeholder="Шахтар" /></label>
        <label>Турнір<input value={f.tournament} onChange={set('tournament')} placeholder="УПЛ, 12 тур" /></label>
        <label>Початок<input type="datetime-local" value={f.kickoff} onChange={set('kickoff')} required /></label>
        <label>
          Ставка (бали)
          <input type="number" step="0.5" min="0.5" value={f.stake} onChange={set('stake')} placeholder="за замовч." disabled={match?.participants > 0} />
        </label>
        <label title="Бали «від дому», які додаються до банку матчу">
          Бонус у банк
          <input type="number" step="0.5" min="0" value={f.bonus} onChange={set('bonus')} />
        </label>
      </div>
      <div className="row">
        <button className="btn primary">{match ? 'Зберегти' : 'Додати матч'}</button>
        {match && <button type="button" className="btn ghost" onClick={onCancel}>Скасувати редагування</button>}
      </div>
    </form>
  );
}

function AdminMatchRow({ m, onEdit, onChange }) {
  const [score, setScore] = useState({ home: '', away: '' });
  const started = Date.parse(m.kickoff) <= Date.now();

  const setResult = async (e) => {
    e.preventDefault();
    let force = false;
    if (!started) {
      if (!confirm('Матч ще не почався за розкладом. Все одно внести результат?')) return;
      force = true;
    }
    if (!confirm(`Підтвердити рахунок ${m.home} ${score.home}:${score.away} ${m.away}? Бали розподіляться одразу.`)) return;
    (await run(() => api.post(`/api/admin/matches/${m.id}/result`, { ...score, force }), 'Результат внесено, бали розподілено 🏆')) && onChange();
  };
  const cancel = async () =>
    confirm('Скасувати матч? Усім повернуться ставки.') &&
    (await run(() => api.post(`/api/admin/matches/${m.id}/cancel`), 'Матч скасовано')) &&
    onChange();
  const reopen = async () =>
    confirm('Відкотити результат? Виплати буде анульовано, матч знову стане відкритим (можна внести правильний рахунок).') &&
    (await run(() => api.post(`/api/admin/matches/${m.id}/reopen`), 'Результат відкочено')) &&
    onChange();
  const remove = async () =>
    confirm('Видалити матч назавжди?') && (await run(() => api.del(`/api/admin/matches/${m.id}`), 'Видалено')) && onChange();

  return (
    <div className="card admin-row">
      <div>
        <b>{m.home} — {m.away}</b> {m.status === 'finished' && <b>({m.homeScore}:{m.awayScore})</b>}
        <div className="muted small">
          {m.tournament && `${m.tournament} · `}
          {fmtDate(m.kickoff)} · ставка {pts(m.stake)} · 👥 {m.participants} · банк {pts(m.pot)}
          {m.status === 'cancelled' && ' · скасовано'}
        </div>
      </div>
      {m.status === 'open' ? (
        <div className="admin-actions">
          <form className="row" onSubmit={setResult}>
            <input className="score-mini" type="number" min="0" required value={score.home} onChange={(e) => setScore({ ...score, home: e.target.value })} />
            :
            <input className="score-mini" type="number" min="0" required value={score.away} onChange={(e) => setScore({ ...score, away: e.target.value })} />
            <button className="btn primary small-btn">Фінал</button>
          </form>
          <div className="row">
            {onEdit && <button className="btn ghost small-btn" onClick={onEdit}>✏️</button>}
            <button className="btn ghost small-btn" onClick={cancel}>Скасувати</button>
            {m.participants === 0 && <button className="btn ghost small-btn" onClick={remove}>🗑️</button>}
          </div>
        </div>
      ) : (
        <button className="btn ghost small-btn" onClick={reopen}>↩️ Відкотити</button>
      )}
    </div>
  );
}

// ---------------- Гравці ----------------

function AdminUsers() {
  const { user: me, refresh } = useMe();
  const [users, setUsers] = useState(null);
  const load = () => api.get('/api/admin/users').then(setUsers);
  useEffect(() => {
    load();
  }, []);
  if (!users) return <div className="loading">⚽</div>;

  const adjust = async (u) => {
    const amount = prompt(`Скільки балів додати гравцю ${u.username}? (відʼємне число — забрати)`, '5');
    if (!amount) return;
    const note = prompt('Коментар (видно гравцю в історії)', Number(amount) > 0 ? 'Трансфер від адміна' : 'Штраф');
    (await run(() => api.post(`/api/admin/users/${u.id}/adjust`, { amount, note }), 'Баланс змінено')) && (load(), refresh());
  };
  const toggleAdmin = async (u) =>
    (await run(() => api.post(`/api/admin/users/${u.id}/admin`, { isAdmin: !u.isAdmin }))) && load();
  const resetPw = async (u) => {
    const password = prompt(`Новий пароль для ${u.username}:`);
    if (password) await run(() => api.post(`/api/admin/users/${u.id}/password`, { password }), 'Пароль змінено');
  };

  return (
    <section>
      <h2>Гравці ({users.length})</h2>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr><th>Логін</th><th>Баланс</th><th>Адмін</th><th /></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td><b>{pts(u.balance)}</b></td>
                <td>
                  <input type="checkbox" checked={!!u.isAdmin} disabled={u.id === me.id} onChange={() => toggleAdmin(u)} />
                </td>
                <td className="row nowrap">
                  <button className="btn ghost small-btn" onClick={() => adjust(u)}>± бали</button>
                  <button className="btn ghost small-btn" onClick={() => resetPw(u)}>🔑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------- Налаштування ----------------

function AdminSettings() {
  const { refresh, jackpot } = useMe();
  const [s, setS] = useState(null);
  useEffect(() => {
    api.get('/api/admin/settings').then(setS);
  }, []);
  if (!s) return <div className="loading">⚽</div>;
  const set = (k, num = true) => (e) => setS({ ...s, [k]: num ? e.target.value : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    (await run(() => api.put('/api/admin/settings', s).then(setS), 'Збережено ✅')) && refresh();
  };
  const adjustJackpot = async () => {
    const amount = prompt('Скільки додати в джекпот? (відʼємне — забрати)', '5');
    if (amount) (await run(() => api.post('/api/admin/jackpot', { amount }), 'Джекпот змінено 🎰')) && refresh();
  };

  return (
    <form className="card stack" onSubmit={save}>
      <h2>Налаштування</h2>
      <div className="form-grid">
        <label>Назва сайту<input value={s.siteName} onChange={set('siteName', false)} /></label>
        <label>Код запрошення<input value={s.inviteCode} onChange={set('inviteCode', false)} placeholder="порожньо = реєстрація відкрита" /></label>
        <label>Стартовий баланс<input type="number" step="0.5" min="0" value={s.startingBalance} onChange={set('startingBalance')} /></label>
        <label>Ставка за замовчуванням<input type="number" step="0.5" min="0.5" value={s.defaultStake} onChange={set('defaultStake')} /></label>
      </div>
      <h3>Ваги прогнозів</h3>
      <p className="muted small">Банк матчу ділиться пропорційно вагам. Чим більша вага точного рахунку відносно інших — тим більший приз за нього.</p>
      <div className="form-grid">
        <label>🎯 Точний рахунок<input type="number" step="0.5" min="0" value={s.wExact} onChange={set('wExact')} /></label>
        <label>🔥 Результат + різниця<input type="number" step="0.5" min="0" value={s.wDiff} onChange={set('wDiff')} /></label>
        <label>👍 Лише результат<input type="number" step="0.5" min="0" value={s.wOutcome} onChange={set('wOutcome')} /></label>
        <label>🤏 Майже (±1 гол)<input type="number" step="0.5" min="0" value={s.wNear} onChange={set('wNear')} /></label>
      </div>
      <h3>Інше</h3>
      <div className="form-grid">
        <label>
          Якщо ніхто не вгадав
          <select value={s.noWinnerPolicy} onChange={set('noWinnerPolicy', false)}>
            <option value="jackpot">Банк → у джекпот 🎰</option>
            <option value="refund">Повернути ставки</option>
          </select>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={s.allowDebt} onChange={(e) => setS({ ...s, allowDebt: e.target.checked })} />
          Дозволити ставити в мінус
        </label>
      </div>
      <div className="row">
        <button className="btn primary">Зберегти</button>
        <button type="button" className="btn ghost" onClick={adjustJackpot}>🎰 Джекпот: {pts(jackpot)}</button>
      </div>
    </form>
  );
}
