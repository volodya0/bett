import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api, pts } from './api.js';
import { installGlobalEggs, QUOTES, rain, toast } from './eggs.js';
import Auth from './pages/Auth.jsx';
import Matches from './pages/Matches.jsx';
import MatchPage from './pages/MatchPage.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import History from './pages/History.jsx';
import Rules from './pages/Rules.jsx';
import Admin from './pages/Admin.jsx';
import NotFound from './pages/NotFound.jsx';

const MeContext = createContext(null);
export const useMe = () => useContext(MeContext);

export default function App() {
  const [me, setMe] = useState(null);
  const refresh = useCallback(() => api.get('/api/me').then(setMe).catch(() => setMe({ user: null })), []);

  useEffect(() => {
    refresh();
    return installGlobalEggs();
  }, [refresh]);

  // Keep the balance fresh: refresh on every navigation and once a minute.
  const location = useLocation();
  useEffect(() => {
    refresh();
  }, [location.pathname, refresh]);
  useEffect(() => {
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (me?.siteName) document.title = me.siteName;
  }, [me?.siteName]);

  const ctx = useMemo(() => ({ ...me, refresh }), [me, refresh]);
  if (!me) return <div className="loading">⚽</div>;

  return (
    <MeContext.Provider value={ctx}>
      <Header />
      <main className="container">
        {me.user ? (
          <Routes>
            <Route path="/" element={<Matches />} />
            <Route path="/match/:id" element={<MatchPage />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/history" element={<History />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/admin/*" element={me.user.isAdmin ? <Admin /> : <Navigate to="/" />} />
            <Route path="/login" element={<Navigate to="/" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/rules" element={<Rules />} />
            <Route path="*" element={<Auth />} />
          </Routes>
        )}
      </main>
      <Footer />
    </MeContext.Provider>
  );
}

function Header() {
  const { user, siteName, jackpot, refresh } = useMe();
  const clicks = useRef([]);
  const [spin, setSpin] = useState(false);

  // 🥚 Seven clicks on the ball within 3 seconds.
  const onLogoClick = (e) => {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < 3000), now];
    if (clicks.current.length >= 7) {
      e.preventDefault();
      clicks.current = [];
      setSpin(true);
      setTimeout(() => setSpin(false), 1500);
      toast('7 кліків — як 7:1 Німеччина–Бразилія. Досить знущатись з мʼяча! 🇩🇪');
    }
  };

  const logout = async () => {
    await api.post('/api/logout');
    refresh();
  };

  const broke = user && user.balance <= 0;

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo" onClick={onLogoClick}>
          <span className={'ball' + (spin ? ' spin' : '')}>⚽</span>
          <span className="logo-text">{siteName}</span>
        </Link>
        {user && (
          <div className="wallet">
            <span
              className={'balance' + (broke ? ' broke' : '')}
              title={broke ? 'Банкрут. Як «Пармa» у 2015-му 🫠' : 'Твій баланс'}
              onClick={() => broke && toast('Банкрут 🫠 Попроси адміна про трансфер.')}
            >
              💰 {pts(user.balance)}
            </span>
            {jackpot > 0 && (
              <span className="jackpot" title="Джекпот: дістанеться тим, хто вгадає точний рахунок" onClick={() => rain(['💰', '🪙'], 25)}>
                🎰 {pts(jackpot)}
              </span>
            )}
          </div>
        )}
      </div>
      {user && (
        <nav className="container nav">
          <NavLink to="/" end>Матчі</NavLink>
          <NavLink to="/leaderboard">Таблиця</NavLink>
          <NavLink to="/history">Історія</NavLink>
          <NavLink to="/rules">Правила</NavLink>
          {user.isAdmin && <NavLink to="/admin">Адмінка</NavLink>}
          <span className="nav-spacer" />
          <span className="nav-user">👤 {user.username}</span>
          <button className="link" onClick={logout}>Вийти</button>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  const { version } = useMe();
  const [i, setI] = useState(() => Math.floor(Math.random() * QUOTES.length));
  return (
    <footer className="footer container">
      <p className="quote" onClick={() => setI((i + 1) % QUOTES.length)} title="Клікни — буде інша">
        {QUOTES[i]}
      </p>
      <p className="muted small">Грається на умовні бали. Жодних грошей, лише гордість 🏆 · <span title="Версія">v{version}</span></p>
    </footer>
  );
}
