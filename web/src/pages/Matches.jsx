import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate, plural, pts, TIER } from '../api.js';

export function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function countdown(iso, now) {
  const diff = Date.parse(iso) - now;
  if (diff <= 0) return null;
  const m = Math.floor(diff / 60000);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d) return `${d} д ${h} год`;
  if (h) return `${h} год ${mm} хв`;
  return `${mm} хв`;
}

export default function Matches() {
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
      <Section title="🟢 Можна ставити" empty="Поки що матчів немає. Адмін, прокидайся! ⏰" list={open} now={now} />
      {live.length > 0 && <Section title="🔴 Йдуть / чекають на результат" list={live} now={now} />}
      {done.length > 0 && <Section title="🏁 Завершені" list={done} now={now} />}
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
  const cd = m.status === 'open' ? countdown(m.kickoff, now) : null;
  return (
    <Link to={`/match/${m.id}`} className={'card match-card status-' + m.status}>
      <div className="match-meta">
        <span>{m.tournament || 'Матч'}</span>
        <span>{fmtDate(m.kickoff)}</span>
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
          👥 {m.participants} · 🏦 {pts(m.pot)} {m.bonus > 0 && <span className="badge">+бонус</span>}
        </span>
        {m.status === 'cancelled' ? (
          <span className="muted">скасовано</span>
        ) : cd ? (
          <span className="muted">⏳ {cd}</span>
        ) : m.status === 'open' ? (
          <span className="live">● LIVE</span>
        ) : null}
      </div>
      <div className="my-bet">
        {m.my ? (
          <>
            Мій прогноз: <b>{m.my.home}:{m.my.away}</b>
            {m.status === 'finished' &&
              (m.my.payout > 0 ? (
                <span className="win">
                  {' '}
                  {TIER[m.my.tier]?.emoji} +{pts(m.my.payout)}
                </span>
              ) : (
                <span className="lose"> 💸 мимо</span>
              ))}
          </>
        ) : m.status === 'open' && cd ? (
          <span className="cta">Зробити прогноз → (ставка {pts(m.stake)} {plural(m.stake / 100, 'бал', 'бали', 'балів')})</span>
        ) : (
          <span className="muted">Без мене</span>
        )}
      </div>
    </Link>
  );
}
