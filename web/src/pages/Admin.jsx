import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api, fmtDate, pts, signedPts } from '../api.js';
import { useMe } from '../App.jsx';
import { useI18n } from '../i18n.jsx';
import { toast } from '../ui.js';

export default function Admin() {
  const { t } = useI18n();
  const { pendingCount } = useMe();
  return (
    <div className="stack-lg">
      <nav className="subnav">
        <NavLink to="/admin" end>{t('admin.matches')}</NavLink>
        <NavLink to="/admin/users">
          {t('admin.players')}
          {pendingCount > 0 && <span className="count">{pendingCount}</span>}
        </NavLink>
        <NavLink to="/admin/settings">{t('admin.settings')}</NavLink>
      </nav>
      <Routes>
        <Route index element={<AdminMatches />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="settings" element={<AdminSettings />} />
      </Routes>
    </div>
  );
}

// datetime-local uses the browser's local time → convert to/from ISO.
const toLocalInput = (iso) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const fromLocalInput = (v) => new Date(v).toISOString();

const run = async (fn, okMsg) => {
  try {
    const r = await fn();
    if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg);
    return true;
  } catch (e) {
    alert(e.message);
    return false;
  }
};

// ---------------- Matches ----------------

function AdminMatches() {
  const { t } = useI18n();
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

  if (!matches) return <div className="loading" />;
  const open = matches.filter((m) => m.status === 'open');
  const closed = matches.filter((m) => m.status !== 'open').reverse();

  return (
    <>
      <MatchForm key={editing?.id || 'new'} match={editing} onDone={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />
      {!editing && <JsonImport onDone={reload} />}
      <section>
        <h2>{t('admin.active')}</h2>
        {open.length === 0 && <p className="muted">{t('admin.none')}</p>}
        <div className="stack">
          {open.map((m) => (
            <AdminMatchRow key={m.id} m={m} onEdit={() => { setEditing(m); window.scrollTo({ top: 0, behavior: 'smooth' }); }} onChange={reload} />
          ))}
        </div>
      </section>
      {closed.length > 0 && (
        <section>
          <h2>{t('admin.closed')}</h2>
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
  const { t } = useI18n();
  const [f, setF] = useState(() =>
    match
      ? { home: match.home, away: match.away, tournament: match.tournament, kickoff: toLocalInput(match.kickoff), stake: match.stake / 100, bonus: match.bonus / 100 }
      : { home: '', away: '', tournament: '', kickoff: '', stake: '', bonus: 0 }
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const body = { ...f, kickoff: fromLocalInput(f.kickoff) };
    if (body.stake === '' || (match && match.participants > 0)) delete body.stake;
    const ok = await run(
      () => (match ? api.put(`/api/admin/matches/${match.id}`, body) : api.post('/api/admin/matches', body)),
      match ? t('admin.updated') : t('admin.added')
    );
    if (ok) {
      if (!match) setF({ ...f, home: '', away: '' });
      onDone();
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>{match ? t('admin.editMatch', { match: `${match.home} — ${match.away}` }) : t('admin.newMatch')}</h2>
      <div className="form-grid">
        <label>{t('admin.home')}<input value={f.home} onChange={set('home')} required /></label>
        <label>{t('admin.away')}<input value={f.away} onChange={set('away')} required /></label>
        <label>{t('admin.tournament')}<input value={f.tournament} onChange={set('tournament')} /></label>
        <label>{t('admin.kickoff')}<input type="datetime-local" value={f.kickoff} onChange={set('kickoff')} required /></label>
        <label>
          {t('admin.stake')}
          <input type="number" step="0.5" min="0.5" value={f.stake} onChange={set('stake')} placeholder={t('admin.stakeDefault')} disabled={match?.participants > 0} />
        </label>
        <label title={t('admin.bonusHint')}>
          {t('admin.bonus')}
          <input type="number" step="0.5" min="0" value={f.bonus} onChange={set('bonus')} />
        </label>
      </div>
      <div className="row">
        <button className="btn primary">{match ? t('admin.save') : t('admin.add')}</button>
        {match && <button type="button" className="btn ghost" onClick={onCancel}>{t('admin.cancelEdit')}</button>}
      </div>
    </form>
  );
}

const JSON_EXAMPLE = `[
  {
    "home": "Шахтар",
    "away": "Динамо Київ",
    "tournament": "УПЛ, 12 тур",
    "kickoff": "2026-11-01T17:00:00+02:00"
  }
]`;

function JsonImport({ onDone }) {
  const { t, locale } = useI18n();
  const [text, setText] = useState('');

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    try {
      const v = JSON.parse(text);
      const list = Array.isArray(v) ? v : [v];
      return { list };
    } catch (e) {
      return { error: e.message };
    }
  }, [text]);

  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(
      () => api.post('/api/admin/matches/import', { matches: parsed.list }),
      (r) => t('admin.importDone', r)
    );
    if (ok) {
      setText('');
      onDone();
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>{t('admin.importTitle')}</h2>
      <p className="muted small">{t('admin.importHint')}</p>
      <textarea className="json-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={JSON_EXAMPLE} rows={8} spellCheck={false} />
      {parsed?.error && <div className="error">{t('admin.importInvalid', { error: parsed.error })}</div>}
      {parsed?.list && (
        <div className="small">
          <b>{t('admin.importPreview', { n: parsed.list.length })}</b>
          <ul className="import-preview">
            {parsed.list.map((m, i) => {
              const d = new Date(m?.kickoff);
              return (
                <li key={i}>
                  {m?.home || '?'} — {m?.away || '?'}
                  <span className="muted"> · {Number.isNaN(d.getTime()) ? '?' : fmtDate(m.kickoff, locale)}{m?.tournament ? ` · ${m.tournament}` : ''}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="row">
        <button className="btn primary" disabled={!parsed?.list}>{t('admin.importButton')}</button>
      </div>
      <AiPrompt />
    </form>
  );
}

function AiPrompt() {
  const { t } = useI18n();
  const prompt = t('admin.aiPrompt');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // Fallback for browsers without clipboard API access.
      const ta = document.createElement('textarea');
      ta.value = prompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast(t('admin.aiCopied'));
  };
  return (
    <details className="ai-prompt">
      <summary>{t('admin.aiTitle')}</summary>
      <p className="muted small">{t('admin.aiHint')}</p>
      <pre>{prompt}</pre>
      <button type="button" className="btn ghost small-btn" onClick={copy}>{t('admin.aiCopy')}</button>
    </details>
  );
}

function AdminMatchRow({ m, onEdit, onChange }) {
  const { t, locale } = useI18n();
  const [score, setScore] = useState({ home: '', away: '' });
  const started = Date.parse(m.kickoff) <= Date.now();

  const setResult = async (e) => {
    e.preventDefault();
    let force = false;
    if (!started) {
      if (!confirm(t('admin.confirmEarly'))) return;
      force = true;
    }
    if (!confirm(t('admin.confirmResult', { score: `${m.home} ${score.home}:${score.away} ${m.away}` }))) return;
    (await run(() => api.post(`/api/admin/matches/${m.id}/result`, { ...score, force }), t('admin.resultSaved'))) && onChange();
  };
  const cancel = async () =>
    confirm(t('admin.confirmCancel')) && (await run(() => api.post(`/api/admin/matches/${m.id}/cancel`), t('admin.cancelled'))) && onChange();
  const reopen = async () =>
    confirm(t('admin.confirmReopen')) && (await run(() => api.post(`/api/admin/matches/${m.id}/reopen`), t('admin.reopened'))) && onChange();
  const remove = async () =>
    confirm(t('admin.confirmDelete')) && (await run(() => api.del(`/api/admin/matches/${m.id}`), t('admin.deleted'))) && onChange();

  return (
    <div className="card admin-row">
      <div>
        <b>{m.home} — {m.away}</b> {m.status === 'finished' && <b>({m.homeScore}:{m.awayScore})</b>}
        <div className="muted small">
          {m.tournament && `${m.tournament} · `}
          {t('admin.matchInfo', { when: fmtDate(m.kickoff, locale), stake: pts(m.stake), people: m.participants, pot: pts(m.pot) })}
          {m.status === 'cancelled' && t('admin.cancelledTag')}
        </div>
      </div>
      {m.status === 'open' ? (
        <div className="admin-actions">
          <form className="row" onSubmit={setResult}>
            <input className="score-mini" type="number" min="0" required value={score.home} onChange={(e) => setScore({ ...score, home: e.target.value })} />
            :
            <input className="score-mini" type="number" min="0" required value={score.away} onChange={(e) => setScore({ ...score, away: e.target.value })} />
            <button className="btn primary small-btn">{t('admin.final')}</button>
          </form>
          <div className="row">
            {onEdit && <button className="btn ghost small-btn" onClick={onEdit}>{t('admin.edit')}</button>}
            <button className="btn ghost small-btn" onClick={cancel}>{t('admin.cancelMatch')}</button>
            {m.participants === 0 && <button className="btn ghost small-btn" onClick={remove}>{t('admin.delete')}</button>}
          </div>
        </div>
      ) : (
        <button className="btn ghost small-btn" onClick={reopen}>{t('admin.reopen')}</button>
      )}
    </div>
  );
}

// ---------------- Players ----------------

function AdminUsers() {
  const { t } = useI18n();
  const { user: me, refresh } = useMe();
  const [users, setUsers] = useState(null);
  const load = () => api.get('/api/admin/users').then(setUsers);
  useEffect(() => {
    load();
  }, []);
  if (!users) return <div className="loading" />;

  const reload = () => {
    load();
    refresh();
  };
  const approve = async (u) =>
    (await run(() => api.post(`/api/admin/users/${u.id}/approve`), t('admin.approved', { user: u.username }))) && reload();
  const reject = async (u) =>
    confirm(t('admin.confirmReject', { user: u.username })) &&
    (await run(() => api.del(`/api/admin/users/${u.id}`), t('admin.rejected'))) &&
    reload();
  const adjust = async (u) => {
    const amount = prompt(t('admin.adjustPrompt', { user: u.username }), '5');
    if (!amount) return;
    const note = prompt(t('admin.adjustNote'), '');
    (await run(() => api.post(`/api/admin/users/${u.id}/adjust`, { amount, note }), t('admin.adjusted'))) && reload();
  };
  const toggleAdmin = async (u) => (await run(() => api.post(`/api/admin/users/${u.id}/admin`, { isAdmin: !u.isAdmin }))) && load();
  const resetPw = async (u) => {
    const password = prompt(t('admin.passwordPrompt', { user: u.username }));
    if (password) await run(() => api.post(`/api/admin/users/${u.id}/password`, { password }), t('admin.passwordChanged'));
  };

  return (
    <section>
      <h2>{t('admin.playersTitle', { n: users.length })}</h2>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr><th>{t('admin.colUser')}</th><th>{t('admin.colBalance')}</th><th>{t('admin.colAdmin')}</th><th /></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.approved ? '' : 'pending-row'}>
                <td>
                  {u.username} {!u.approved && <span className="badge">{t('admin.pending')}</span>}
                </td>
                <td><b>{signedPts(u.balance)}</b></td>
                <td>
                  <input type="checkbox" checked={!!u.isAdmin} disabled={u.id === me.id || !u.approved} onChange={() => toggleAdmin(u)} />
                </td>
                <td className="row nowrap">
                  {u.approved ? (
                    <>
                      <button className="btn ghost small-btn" onClick={() => adjust(u)}>{t('admin.adjustButton')}</button>
                      <button className="btn ghost small-btn" onClick={() => resetPw(u)}>{t('admin.password')}</button>
                    </>
                  ) : (
                    <>
                      <button className="btn primary small-btn" onClick={() => approve(u)}>{t('admin.approve')}</button>
                      <button className="btn ghost small-btn" onClick={() => reject(u)}>{t('admin.reject')}</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------- Settings ----------------

function AdminSettings() {
  const { t } = useI18n();
  const { refresh } = useMe();
  const [s, setS] = useState(null);
  useEffect(() => {
    api.get('/api/admin/settings').then(setS);
  }, []);
  if (!s) return <div className="loading" />;
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    (await run(() => api.put('/api/admin/settings', s).then(setS), t('admin.saved'))) && refresh();
  };

  return (
    <>
      <form className="card stack" onSubmit={save}>
        <h2>{t('admin.settings')}</h2>
        <div className="form-grid">
          <label>{t('admin.siteName')}<input value={s.siteName} onChange={set('siteName')} /></label>
          <label>{t('admin.invite')}<input value={s.inviteCode} onChange={set('inviteCode')} placeholder={t('admin.invitePlaceholder')} /></label>
          <label>{t('admin.defaultStake')}<input type="number" step="0.5" min="0.5" value={s.defaultStake} onChange={set('defaultStake')} /></label>
          <label className="checkbox">
            <input type="checkbox" checked={!!s.requireApproval} onChange={(e) => setS({ ...s, requireApproval: e.target.checked })} />
            {t('admin.requireApproval')}
          </label>
        </div>
        <h3>{t('admin.weights')}</h3>
        <p className="muted small">{t('admin.weightsHint')}</p>
        <div className="form-grid">
          <label>{t('rules.exact')}<input type="number" step="0.5" min="0" value={s.wExact} onChange={set('wExact')} /></label>
          <label>{t('rules.diff')}<input type="number" step="0.5" min="0" value={s.wDiff} onChange={set('wDiff')} /></label>
          <label>{t('rules.outcome')}<input type="number" step="0.5" min="0" value={s.wOutcome} onChange={set('wOutcome')} /></label>
          <label>{t('rules.near')}<input type="number" step="0.5" min="0" value={s.wNear} onChange={set('wNear')} /></label>
        </div>
        <div className="row">
          <button className="btn primary">{t('admin.save')}</button>
        </div>
      </form>
      <div className="card stack">
        <h2>{t('admin.data')}</h2>
        <p className="muted small">{t('admin.exportHint')}</p>
        <div className="row">
          <a className="btn ghost" href="/api/admin/export" download>{t('admin.export')}</a>
        </div>
      </div>
    </>
  );
}
