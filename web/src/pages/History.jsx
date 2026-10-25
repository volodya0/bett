import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, pts } from '../api.js';

const KIND = { start: '🎁', stake: '🎟️', payout: '🏆', refund: '↩️', admin: '🧙', jackpot: '🎰' };

export default function History() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api.get('/api/history').then(setRows);
  }, []);
  if (!rows) return <div className="loading">⚽</div>;
  return (
    <section>
      <h2>Історія балансу</h2>
      {rows.length === 0 ? (
        <p className="muted">Поки порожньо.</p>
      ) : (
        <ul className="card history">
          {rows.map((r, i) => (
            <li key={i}>
              <span className="kind">{KIND[r.kind] || '•'}</span>
              <span className="note">
                {r.match_id ? <Link to={`/match/${r.match_id}`}>{r.note}</Link> : r.note}
                <span className="muted small"> · {new Date(r.created_at + 'Z').toLocaleString('uk-UA')}</span>
              </span>
              <span className={r.amount > 0 ? 'win' : 'lose'}>
                {r.amount > 0 ? '+' : ''}
                {pts(r.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
