import React, { useEffect, useState } from 'react';
import { api, signedPts } from '../api.js';
import { useMe } from '../App.jsx';
import { useI18n } from '../i18n.jsx';

export default function Leaderboard() {
  const { user } = useMe();
  const { t } = useI18n();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api.get('/api/leaderboard').then(setRows);
  }, []);
  if (!rows) return <div className="loading">⚽</div>;

  return (
    <section>
      <h2>{t('table.title')}</h2>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('table.player')}</th>
              <th title={t('table.betsHint')}>{t('table.bets')}</th>
              <th title={t('table.hitsHint')}>{t('table.hits')}</th>
              <th title={t('table.exactHint')}>🎯</th>
              <th>{t('table.balance')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={r.id === user.id ? 'me' : ''}>
                <td className="pos">{['🥇', '🥈', '🥉'][i] || i + 1}</td>
                <td>{r.username}</td>
                <td>{r.bets}</td>
                <td>{r.hits}</td>
                <td>{r.exact}</td>
                <td className={r.balance > 0 ? 'win' : r.balance < 0 ? 'lose' : ''}>
                  <b>{signedPts(r.balance)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
