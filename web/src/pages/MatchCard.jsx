import React, { useState } from 'react';
import { api, fmtDate, pts } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { toast } from '../ui.js';
import Comments from '../Comments.jsx';
import { countdown } from '../time.js';

// Everything about a match on one big card: info, your prediction, players, comments.
export default function MatchCard({ m, now, onChange }) {
  const { t, lang, locale } = useI18n();
  const open = m.status === 'open' && Date.parse(m.kickoff) > now;
  const cd = countdown(m.kickoff, now, lang);

  return (
    <article id={`match-${m.id}`} className={'card match-card status-' + m.status}>
      <div className="match-meta">
        <span>{m.tournament || t('match.default')}</span>
        <span>{fmtDate(m.kickoff, locale)}</span>
      </div>
      <div className="teams big">
        <span className="team">{m.home}</span>
        <span className="score">
          {m.status === 'finished' ? `${m.homeScore}:${m.awayScore}` : m.status === 'cancelled' ? '—' : 'vs'}
        </span>
        <span className="team">{m.away}</span>
      </div>
      <div className={'match-status' + (!open && m.status === 'open' ? ' live' : '')}>
        {m.status === 'cancelled'
          ? t('match.cancelled')
          : open
            ? `🔥 ${t('match.startsIn', { time: cd })}`
            : m.status === 'finished'
              ? t('match.finished')
              : t('match.inPlay')}
      </div>

      {m.my && m.status === 'finished' && <MyResult my={m.my} />}

      <div className="people-block">
        {m.people.length === 0 ? <p className="muted small">{t('match.nobody')}</p> : <ParticipantList list={m.people} m={m} />}
      </div>

      {open && <PredictForm m={m} onDone={onChange} />}
      {open && <p className="muted small hint">{t('match.hiddenNote')}</p>}

      <Comments matchId={m.id} count={m.comments} />
    </article>
  );
}

function PredictForm({ m, onDone }) {
  const { t } = useI18n();
  const [home, setHome] = useState(m.my?.home ?? 0);
  const [away, setAway] = useState(m.my?.away ?? 0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const changed = !m.my || Number(home) !== m.my.home || Number(away) !== m.my.away;

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

  return (
    <form className={'predict' + (m.my ? ' has-bet' : '')} onSubmit={save}>
      <div className="predict-label">
        {m.my ? t('predict.titleEdit') : t('predict.title')}
        {m.my && changed && <span className="unsaved"> · {t('predict.unsaved')}</span>}
      </div>
      <div className="predict-row">
        <div className="score-pair">
          <ScoreInput value={home} onChange={setHome} />
          <span className="colon">:</span>
          <ScoreInput value={away} onChange={setAway} />
        </div>
        <div className="predict-actions">
          {!m.my ? (
            <button className="btn primary" disabled={busy}>{t('predict.place')}</button>
          ) : (
            changed && (
              <button className="btn primary icon-btn" disabled={busy} title={t('predict.update')} aria-label={t('predict.update')}>
                <CheckIcon />
              </button>
            )
          )}
        </div>
      </div>
      {error && <div className="error">{error}</div>}
    </form>
  );
}

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function ScoreInput({ value, onChange }) {
  const v = Number(value) || 0;
  return (
    <div className="score-input">
      <button type="button" onClick={() => onChange(Math.max(0, v - 1))} aria-label="−">−</button>
      <input
        type="number"
        min="0"
        max="99"
        inputMode="numeric"
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(e.target.value === '' ? '' : Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0)))}
      />
      <button type="button" onClick={() => onChange(Math.min(99, v + 1))} aria-label="+">+</button>
    </div>
  );
}

function MyResult({ my }) {
  const { t } = useI18n();
  const score = `${my.home}:${my.away}`;
  return (
    <div className={'my-result ' + (my.payout > 0 ? 'won' : 'lost')}>
      <span>
        {my.payout > 0
          ? t('result.won', { label: t('tier.' + my.tier), score, payout: pts(my.payout) })
          : t('result.lost', { score })}
      </span>
    </div>
  );
}

function ParticipantList({ list, m }) {
  const { t } = useI18n();
  const sorted = m.status === 'finished' ? [...list].sort((a, b) => (b.payout || 0) - (a.payout || 0)) : list;
  return (
    <ul className={'people' + (m.status === 'finished' ? ' with-payout' : '')}>
      {sorted.map((p) => (
        <li key={p.username} className={p.me ? 'me' : ''}>
          <span className="who">{p.username}{p.me && t('match.me')}</span>
          {p.hidden ? (
            <span className="hidden-bet" title={t('match.secret')}>?:?</span>
          ) : (
            <span className="bet">{p.home}:{p.away}</span>
          )}
          {m.status === 'finished' && (
            <span className="payout">
              {p.payout > 0 ? (
                <>
                  <span className="tier">{t('tier.' + p.tier)}</span>
                  <span className="win">+{pts(p.payout)}</span>
                </>
              ) : (
                <span className="muted">0</span>
              )}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
