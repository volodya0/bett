import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtDate, pts, TIER } from '../api.js';
import { useMe } from '../App.jsx';
import { confetti, predictionQuip, toast } from '../eggs.js';
import { countdown, useNow } from './Matches.jsx';

export default function MatchPage() {
  const { id } = useParams();
  const { refresh } = useMe();
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

  // 🎉 Конфеті, якщо вгадав точний рахунок.
  useEffect(() => {
    if (m?.my?.tier === 'exact') confetti();
  }, [m?.my?.tier]);

  if (error) return <div className="error">{error}</div>;
  if (!m) return <div className="loading">⚽</div>;

  const open = m.status === 'open' && Date.parse(m.kickoff) > now;
  const cd = countdown(m.kickoff, now);

  return (
    <div className="stack-lg">
      <Link to="/" className="small">← Усі матчі</Link>
      <div className="card match-hero">
        <div className="match-meta">
          <span>{m.tournament || 'Матч'}</span>
          <span>{fmtDate(m.kickoff)}</span>
        </div>
        <div className="teams big">
          <span className="team">{m.home}</span>
          <span className="score">
            {m.status === 'finished' ? `${m.homeScore}:${m.awayScore}` : m.status === 'cancelled' ? '✖' : 'vs'}
          </span>
          <span className="team">{m.away}</span>
        </div>
        <div className="hero-stats">
          <div><b>{pts(m.stake)}</b><span>ставка</span></div>
          <div><b>{m.participants}</b><span>учасників</span></div>
          <div><b>{pts(m.pot)}</b><span>банк{m.bonus > 0 ? ` (вкл. бонус ${pts(m.bonus)})` : ''}</span></div>
          <div>
            <b>{m.status === 'cancelled' ? '—' : open ? cd : m.status === 'finished' ? '🏁' : '🔴'}</b>
            <span>{m.status === 'cancelled' ? 'скасовано' : open ? 'до старту' : m.status === 'finished' ? 'завершено' : 'йде гра'}</span>
          </div>
        </div>
      </div>

      {open && <PredictForm m={m} onDone={() => { load(); refresh(); }} />}
      {!open && m.my && m.status === 'finished' && <MyResult my={m.my} />}

      <section>
        <h2>Учасники</h2>
        {!m.locked && m.participants > 0 && (
          <p className="muted small">🙈 Прогнози інших відкриються, коли почнеться матч.</p>
        )}
        {m.people.length === 0 ? (
          <p className="muted">Ще ніхто не ставив. Будь першим!</p>
        ) : (
          <ParticipantList list={m.people} m={m} />
        )}
      </section>
    </div>
  );
}

function PredictForm({ m, onDone }) {
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
      toast(predictionQuip(home, away) || (m.my ? 'Прогноз оновлено ✍️' : `Ставку прийнято! −${pts(m.stake)} 💰`));
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!confirm('Забрати ставку? Бали повернуться.')) return;
    try {
      await api.del(`/api/matches/${m.id}/predict`);
      toast('Ставку знято. Злякався? 🐔');
      onDone();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="card predict" onSubmit={save}>
      <h2>{m.my ? 'Твій прогноз (можна змінити до старту)' : 'Твій прогноз'}</h2>
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
          {m.my ? 'Оновити прогноз' : `Поставити ${pts(m.stake)} 💰`}
        </button>
        {m.my && (
          <button type="button" className="btn ghost" onClick={withdraw}>Забрати ставку</button>
        )}
      </div>
    </form>
  );
}

function ScoreInput({ value, onChange }) {
  const v = Number(value) || 0;
  return (
    <div className="score-input">
      <button type="button" onClick={() => onChange(Math.min(99, v + 1))} aria-label="плюс">+</button>
      <input
        type="number"
        min="0"
        max="99"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0)))}
      />
      <button type="button" onClick={() => onChange(Math.max(0, v - 1))} aria-label="мінус">−</button>
    </div>
  );
}

function MyResult({ my }) {
  const t = TIER[my.tier];
  return (
    <div className={'card my-result ' + (my.payout > 0 ? 'won' : 'lost')}>
      {my.payout > 0 ? (
        <>
          <div className="big-emoji">{t?.emoji || '💰'}</div>
          <div>
            <b>{t?.label}!</b> Твій прогноз {my.home}:{my.away} приніс <b>+{pts(my.payout)}</b> балів.
          </div>
        </>
      ) : (
        <>
          <div className="big-emoji">💸</div>
          <div>Прогноз {my.home}:{my.away} не зайшов. Наступного разу точно!</div>
        </>
      )}
    </div>
  );
}

function ParticipantList({ list, m }) {
  const sorted = m.status === 'finished' ? [...list].sort((a, b) => (b.payout || 0) - (a.payout || 0)) : list;
  return (
    <ul className="people">
      {sorted.map((p) => (
        <li key={p.username} className={p.me ? 'me' : ''}>
          <span className="who">{p.username}{p.me && ' (я)'}</span>
          {p.hidden ? (
            <span className="hidden-bet" title="Секрет до старту матчу">🤫 ?:?</span>
          ) : (
            <span className="bet">{p.home}:{p.away}</span>
          )}
          {m.status === 'finished' && (
            <span className="payout">
              {p.payout > 0 ? (
                <span className="win">{TIER[p.tier]?.emoji} +{pts(p.payout)}</span>
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
