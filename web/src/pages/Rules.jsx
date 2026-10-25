import React, { useEffect, useState } from 'react';
import { api, pts } from '../api.js';

export default function Rules() {
  const [r, setR] = useState(null);
  useEffect(() => {
    api.get('/api/rules').then(setR);
  }, []);
  if (!r) return <div className="loading">⚽</div>;

  const total = r.wExact + r.wDiff + r.wOutcome;
  return (
    <section className="card prose">
      <h2>Правила гри</h2>
      <ol>
        <li>Реєструєшся і отримуєш <b>{r.startingBalance}</b> стартових балів.</li>
        <li>
          На кожен матч можна вписати <b>точний рахунок</b>. Прогноз коштує ставку матчу (зазвичай{' '}
          <b>{r.defaultStake}</b>). Змінити або забрати прогноз можна до стартового свистка.
        </li>
        <li>До початку матчу видно, <b>хто</b> вже в грі, але не <b>що</b> він поставив. 🤫</li>
        <li>Після фінального свистка весь банк матчу ділиться між тими, хто був близько — пропорційно «вазі» прогнозу:</li>
      </ol>
      <table className="table">
        <thead>
          <tr><th>Прогноз</th><th>Приклад (факт 2:1)</th><th>Вага</th></tr>
        </thead>
        <tbody>
          <tr><td>🎯 Точний рахунок</td><td>2:1</td><td><b>{r.wExact}</b></td></tr>
          <tr><td>🔥 Переможець + різниця голів</td><td>3:2, 1:0</td><td><b>{r.wDiff}</b></td></tr>
          <tr><td>👍 Лише переможець / нічия</td><td>3:0, 4:1</td><td><b>{r.wOutcome}</b></td></tr>
          <tr><td>🤏 Майже (помилка на 1 гол)</td><td>1:1, 2:2</td><td><b>{r.wNear}</b></td></tr>
          <tr><td>💸 Мимо</td><td>0:3</td><td>0</td></tr>
        </tbody>
      </table>
      <p>
        <b>Приклад:</b> 4 гравці по 1 балу, банк = 4. Один вгадав точно (вага {r.wExact}), інший — лише переможця (вага{' '}
        {r.wOutcome}), двоє мимо. Перший отримує {pts(Math.round((400 * r.wExact) / (r.wExact + r.wOutcome || 1)))}, другий —{' '}
        {pts(Math.round((400 * r.wOutcome) / (r.wExact + r.wOutcome || 1)))}.
      </p>
      <p>
        Якщо ніхто нічого не вгадав —{' '}
        {r.noWinnerPolicy === 'refund' ? (
          <>усім повертаються ставки.</>
        ) : (
          <>
            банк іде в <b>🎰 джекпот</b>. Джекпот повністю забирають ті, хто першим вгадає <b>точний рахунок</b> у будь-якому
            наступному матчі.
          </>
        )}
        {r.jackpot > 0 && <> Зараз у джекпоті: <b>{pts(r.jackpot)}</b>.</>}
      </p>
      <p>Скасований матч = усі ставки повертаються.</p>
      {!r.allowDebt && <p>Ставити можна лише якщо на балансі вистачає балів. Збанкрутував — проси адміна про «трансфер».</p>}
      <p className="muted small">P.S. На сайті є пасхалки. Шукай. {total > 15 ? '🥚' : '🐣'}</p>
    </section>
  );
}
