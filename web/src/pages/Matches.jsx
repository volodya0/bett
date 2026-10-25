import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate, pts, TIER_EMOJI } from '../api.js';
import { useI18n } from '../i18n.jsx';
import Comments from '../Comments.jsx';

export function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const UNITS = { uk: ['д', 'год', 'хв'], en: ['d', 'h', 'min'] };

export function countdown(iso, now, lang) {
  const diff = Date.parse(iso) - now;
  if (diff <= 0) return null;
  const [dU, hU, mU] = UNITS[lang];
  const m = Math.floor(diff / 60000);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d) return `${d} ${dU} ${h} ${hU}`;
  if (h) return `${h} ${hU} ${mm} ${mU}`;
  return `${mm} ${mU}`;
}

export default function Matches() {
  const { t } = useI18n();
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState('');
  const now = useNow();

  useEffect(() => {
    api.get('/api/matches').then(setMatches).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!matches) return <div className="loading">⚽</div>;

  const isOpen = (m) => m.status === 'open' && Date.parse(m.kickoff) > now;
  const open = matches.filter(isOpen);
  const live = matches.filter((m) => m.status === 'open' && !isOpen(m));
  const done = matches.filter((m) => m.status !== 'open').reverse();

  return (
    <div className="stack-lg">
      <Section title={t('matches.open')} empty={t('matches.openEmpty')} list={open} now={now} />
      {live.length > 0 && <Section title={t('matches.live')} list={live} now={now} />}
      {done.length > 0 && <Section title={t('matches.done')} list={done} now={now} />}
    </div>
  );
}

function Section({ title, list, empty, now }) {
  return (
    <section>
      <h2>{title}</h2>
      {list.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <div className="grid">
          {list.map((m) => (
            <MatchCard key={m.id} m={m} now={now} />
          ))}
        </div>
      )}
    </section>
  );
}

function MatchCard({ m, now }) {
  const { t, lang, locale } = useI18n();
  const cd = m.status === 'open' ? countdown(m.kickoff, now, lang) : null;
  return (
    <div className={'card match-card status-' + m.status}>
      <Link to={`/match/${m.id}`} className="match-link">
        <div className="match-meta">
          <span>{m.tournament || t('match.default')}</span>
          <span>{fmtDate(m.kickoff, locale)}</span>
        </div>
        <div className="teams">
          <span className="team">{m.home}</span>
          <span className="score">
            {m.status === 'finished' ? `${m.homeScore}:${m.awayScore}` : m.status === 'cancelled' ? '✖' : 'vs'}
          </span>
          <span className="team">{m.away}</span>
        </div>
        <div className="match-foot">
          <span>
            👥 {m.participants} · 🏦 {pts(m.pot)} {m.bonus > 0 && <span className="badge">{t('match.bonus')}</span>}
          </span>
          {m.status === 'cancelled' ? (
            <span className="muted">{t('match.cancelled')}</span>
          ) : cd ? (
            <span className="muted">⏳ {cd}</span>
          ) : m.status === 'open' ? (
            <span className="live">● LIVE</span>
          ) : null}
        </div>
        <div className="my-bet">
          {m.my ? (
            <>
              {t('match.myBet')} <b>{m.my.home}:{m.my.away}</b>
              {m.status === 'finished' &&
                (m.my.payout > 0 ? (
                  <span className="win"> {TIER_EMOJI[m.my.tier]} +{pts(m.my.payout)}</span>
                ) : (
                  <span className="lose"> {t('match.miss')}</span>
                ))}
            </>
          ) : m.status === 'open' && cd ? (
            <span className="cta">{t('match.makeBet', { stake: pts(m.stake) })}</span>
          ) : (
            <span className="muted">{t('match.notIn')}</span>
          )}
        </div>
      </Link>
      <Comments matchId={m.id} count={m.comments} />
    </div>
  );
}
