import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtDate, pts, TIER_EMOJI } from '../api.js';
import { useMe } from '../App.jsx';
import { useI18n } from '../i18n.jsx';
import { toast } from '../ui.js';
import { countdown, useNow } from './Matches.jsx';
import Comments from '../Comments.jsx';

export default function MatchPage() {
  const { id } = useParams();
  const { refresh } = useMe();
  const { t, lang, locale } = useI18n();
  const [m, setM] = useState(null);
  const [error, setError] = useState('');
  const now = useNow(1000);

  const load = () =>
    api
      .get(`/api/matches/${id}`)
      .then(setM)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [id]);

  if (error) return <div className="error">{error}</div>;
  if (!m) return <div className="loading">⚽</div>;

  const open = m.status === 'open' && Date.parse(m.kickoff) > now;
  const cd = countdown(m.kickoff, now, lang);

  return (
    <div className="stack-lg">
      <Link to="/" className="small">{t('match.back')}</Link>
      <div className="card match-hero">
        <div className="match-meta">
          <span>{m.tournament || t('match.default')}</span>
          <span>{fmtDate(m.kickoff, locale)}</span>
        </div>
        <div className="teams big">
          <span className="team">{m.home}</span>
          <span className="score">
            {m.status === 'finished' ? `${m.homeScore}:${m.awayScore}` : m.status === 'cancelled' ? '✖' : 'vs'}
          </span>
          <span className="team">{m.away}</span>
        </div>
        <div className="hero-stats">
          <div><b>{pts(m.stake)}</b><span>{t('match.stake')}</span></div>
          <div><b>{m.participants}</b><span>{t('match.participants')}</span></div>
          <div>
            <b>{pts(m.pot)}</b>
            <span>{m.bonus > 0 ? t('match.potWithBonus', { bonus: pts(m.bonus) }) : t('match.pot')}</span>
          </div>
          <div>
            <b>{m.status === 'cancelled' ? '—' : open ? cd : m.status === 'finished' ? '🏁' : '🔴'}</b>
            <span>
              {m.status === 'cancelled'
                ? t('match.cancelled')
                : open
                  ? t('match.toKickoff')
                  : m.status === 'finished'
                    ? t('match.finished')
                    : t('match.inPlay')}
            </span>
          </div>
        </div>
      </div>

      {open && <PredictForm m={m} onDone={() => { load(); refresh(); }} />}
      {!open && m.my && m.status === 'finished' && <MyResult my={m.my} />}

      <section>
        <h2>{t('match.people')}</h2>
        {!m.locked && m.participants > 0 && <p className="muted small">{t('match.hiddenNote')}</p>}
        {m.people.length === 0 ? <p className="muted">{t('match.nobody')}</p> : <ParticipantList list={m.people} m={m} />}
      </section>

      <section className="card">
        <Comments matchId={m.id} count={m.comments} defaultOpen />
      </section>
    </div>
  );
}

function PredictForm({ m, onDone }) {
  const { t } = useI18n();
  const [home, setHome] = useState(m.my?.home ?? 0);
  const [away, setAway] = useState(m.my?.away ?? 0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/matches/${m.id}/predict`, { home, away });
      toast(m.my ? t('predict.updated') : t('predict.placed', { stake: pts(m.stake) }));
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!confirm(t('predict.withdrawConfirm'))) return;
    try {
      await api.del(`/api/matches/${m.id}/predict`);
      toast(t('predict.withdrawn'));
      onDone();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="card predict" onSubmit={save}>
      <h2>{m.my ? t('predict.titleEdit') : t('predict.title')}</h2>
      <div className="predict-row">
        <span className="team">{m.home}</span>
        <ScoreInput value={home} onChange={setHome} />
        <span className="colon">:</span>
        <ScoreInput value={away} onChange={setAway} />
        <span className="team">{m.away}</span>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="row center">
        <button className="btn primary" disabled={busy}>
          {m.my ? t('predict.update') : t('predict.place', { stake: pts(m.stake) })}
        </button>
        {m.my && (
          <button type="button" className="btn ghost" onClick={withdraw}>{t('predict.withdraw')}</button>
        )}
      </div>
    </form>
  );
}

function ScoreInput({ value, onChange }) {
  const v = Number(value) || 0;
  return (
    <div className="score-input">
      <button type="button" onClick={() => onChange(Math.min(99, v + 1))} aria-label="+">+</button>
      <input
        type="number"
        min="0"
        max="99"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0)))}
      />
      <button type="button" onClick={() => onChange(Math.max(0, v - 1))} aria-label="−">−</button>
    </div>
  );
}

function MyResult({ my }) {
  const { t } = useI18n();
  const score = `${my.home}:${my.away}`;
  return (
    <div className={'card my-result ' + (my.payout > 0 ? 'won' : 'lost')}>
      <div className="big-emoji">{my.payout > 0 ? TIER_EMOJI[my.tier] || '💰' : '💸'}</div>
      <div>
        {my.payout > 0
          ? t('result.won', { label: t('tier.' + my.tier), score, payout: pts(my.payout) })
          : t('result.lost', { score })}
      </div>
    </div>
  );
}

function ParticipantList({ list, m }) {
  const { t } = useI18n();
  const sorted = m.status === 'finished' ? [...list].sort((a, b) => (b.payout || 0) - (a.payout || 0)) : list;
  return (
    <ul className="people">
      {sorted.map((p) => (
        <li key={p.username} className={p.me ? 'me' : ''}>
          <span className="who">{p.username}{p.me && t('match.me')}</span>
          {p.hidden ? (
            <span className="hidden-bet" title={t('match.secret')}>🤫 ?:?</span>
          ) : (
            <span className="bet">{p.home}:{p.away}</span>
          )}
          <span className="payout">
            {m.status === 'finished' &&
              (p.payout > 0 ? (
                <span className="win" title={t('tier.' + p.tier)}>{TIER_EMOJI[p.tier]} +{pts(p.payout)}</span>
              ) : (
                <span className="muted">0</span>
              ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
