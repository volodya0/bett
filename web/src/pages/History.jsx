import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, signedPts } from '../api.js';
import { useI18n } from '../i18n.jsx';

const KIND = { stake: '🎟️', payout: '🏆', refund: '↩️', admin: '🧙' };

export default function History() {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api.get('/api/history').then(setRows);
  }, []);
  if (!rows) return <div className="loading">⚽</div>;

  const describe = (r) => {
    if (r.kind === 'admin') return r.note || t('history.admin');
    if (!r.home) return r.note || t('history.legacy');
    const score = r.homeScore != null ? ` ${r.homeScore}:${r.awayScore} ` : ' — ';
    const match = `${r.home}${score}${r.away}`;
    return t('history.' + r.kind, { match });
  };

  return (
    <section>
      <h2>{t('history.title')}</h2>
      {rows.length === 0 ? (
        <p className="muted">{t('history.empty')}</p>
      ) : (
        <ul className="card history">
          {rows.map((r, i) => (
            <li key={i}>
              <span className="kind">{KIND[r.kind] || '•'}</span>
              <span className="note">
                {r.matchId ? <Link to={`/match/${r.matchId}`}>{describe(r)}</Link> : describe(r)}
                <span className="muted small"> · {new Date(r.createdAt + 'Z').toLocaleString(locale)}</span>
              </span>
              <span className={r.amount > 0 ? 'win' : 'lose'}>{signedPts(r.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
