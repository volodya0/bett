import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useMe } from '../App.jsx';
import { useI18n } from '../i18n.jsx';
import { useNow } from '../time.js';
import Leaderboard from './Leaderboard.jsx';
import MatchCard from './MatchCard.jsx';

export default function Matches() {
  const { t } = useI18n();
  const { refresh } = useMe();
  const { hash } = useLocation();
  const [matches, setMatches] = useState(null);
  const [lbKey, setLbKey] = useState(0);
  const [error, setError] = useState('');
  const now = useNow(1000);

  const load = () => api.get('/api/matches').then(setMatches).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  // Links like /#match-12 scroll to that card once the list is loaded.
  useEffect(() => {
    if (matches && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [matches, hash]);

  const onChange = () => {
    load();
    refresh();
    setLbKey((k) => k + 1);
  };

  if (error) return <div className="error">{error}</div>;
  if (!matches) return <div className="loading">⚽</div>;

  const isOpen = (m) => m.status === 'open' && Date.parse(m.kickoff) > now;
  const open = matches.filter(isOpen);
  const live = matches.filter((m) => m.status === 'open' && !isOpen(m));
  const done = matches.filter((m) => m.status !== 'open').reverse();

  const section = (title, list, empty) => (
    <section className="stack">
      <h2>{title}</h2>
      {list.length === 0 ? <p className="muted">{empty}</p> : list.map((m) => <MatchCard key={m.id} m={m} now={now} onChange={onChange} />)}
    </section>
  );

  return (
    <div className="stack-lg">
      <Leaderboard key={lbKey} />
      {section(t('matches.open'), open, t('matches.openEmpty'))}
      {live.length > 0 && section(t('matches.live'), live)}
      {done.length > 0 && section(t('matches.done'), done)}
    </div>
  );
}
