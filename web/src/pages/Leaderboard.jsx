import React, { useEffect, useState } from 'react';
import { api, pts } from '../api.js';
import { useMe } from '../App.jsx';
import { toast } from '../eggs.js';

export default function Leaderboard() {
  const { user } = useMe();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api.get('/api/leaderboard').then(setRows);
  }, []);
  if (!rows) return <div className="loading">⚽</div>;

  const badge = (i) => {
    if (rows.length > 1 && i === rows.length - 1)
      return <span title="Деревʼяна ложка 🥄" onClick={() => toast('Деревʼяна ложка — теж трофей. Майже.')}>🥄</span>;
    return ['👑', '🥈', '🥉'][i] || i + 1;
  };

  return (
    <section>
      <h2>Турнірна таблиця</h2>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Гравець</th>
              <th title="Кількість ставок">Ставок</th>
              <th title="Ставки, що принесли хоч щось">Влучань</th>
              <th title="Точних рахунків">🎯</th>
              <th>Баланс</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={r.id === user.id ? 'me' : ''}>
                <td className="pos">{badge(i)}</td>
                <td>{r.username}</td>
                <td>{r.bets}</td>
                <td>{r.hits}</td>
                <td>{r.exact}</td>
                <td><b>{pts(r.balance)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
