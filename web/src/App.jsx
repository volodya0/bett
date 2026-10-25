import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { api, signedPts } from './api.js';
import { QUOTES, useI18n } from './i18n.jsx';
import Auth from './pages/Auth.jsx';
import Matches from './pages/Matches.jsx';
import History from './pages/History.jsx';
import Rules from './pages/Rules.jsx';
import Admin from './pages/Admin.jsx';
import NotFound from './pages/NotFound.jsx';

// Footer quotes are hidden for now; flip to true to bring them back.
const SHOW_QUOTES = false;

const MeContext = createContext(null);
export const useMe = () => useContext(MeContext);

export default function App() {
  const { lang } = useI18n();
  const [me, setMe] = useState(null);
  const refresh = useCallback(() => api.get('/api/me').then(setMe).catch(() => setMe({ user: null })), []);

  // Keep the balance fresh: refresh on every navigation and once a minute.
  const location = useLocation();
  useEffect(() => {
    refresh();
  }, [location.pathname, refresh]);

  // Page views go to the admin activity log.
  const loggedIn = !!me?.user;
  useEffect(() => {
    if (loggedIn) api.post('/api/log', { page: location.pathname }).catch(() => {});
  }, [location.pathname, loggedIn]);
  useEffect(() => {
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (me?.siteName) document.title = me.siteName;
  }, [me?.siteName]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const ctx = useMemo(() => ({ ...me, refresh }), [me, refresh]);
  if (!me) return <div className="loading" />;

  return (
    <MeContext.Provider value={ctx}>
      <Header />
      {/* key={lang} remounts pages so data-driven texts re-render in the new language */}
      <main className="container" key={lang}>
        {me.user && !me.user.approved ? (
          <Pending />
        ) : me.user ? (
          <Routes>
            <Route path="/" element={<Matches />} />
            <Route path="/match/:id" element={<MatchRedirect />} />
            <Route path="/leaderboard" element={<Navigate to="/" />} />
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

// Old match links point to the card on the home page.
function MatchRedirect() {
  const { id } = useParams();
  return <Navigate to={`/#match-${id}`} replace />;
}

function Header() {
  const { user, siteName, pendingCount, refresh } = useMe();
  const { t } = useI18n();

  const logout = async () => {
    await api.post('/api/logout');
    refresh();
  };

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">
          <span className="ball">⚽</span>
          <span className="logo-text">{siteName}</span>
        </Link>
        <div className="wallet">
          {user && (
            <span className={'balance' + (user.balance < 0 ? ' negative' : '')} title={t('balance.title')}>
              {signedPts(user.balance)}
            </span>
          )}
        </div>
      </div>
      {user?.approved && (
        <nav className="container nav">
          <NavLink to="/" end>{t('nav.matches')}</NavLink>
          <NavLink to="/history">{t('nav.history')}</NavLink>
          <NavLink to="/rules">{t('nav.rules')}</NavLink>
          {user.isAdmin && (
            <NavLink to="/admin">
              {t('nav.admin')}
              {pendingCount > 0 && <span className="count">{pendingCount}</span>}
            </NavLink>
          )}
          <span className="nav-spacer" />
          <span className="nav-user">{user.username}</span>
          <button className="link" onClick={logout}>{t('nav.logout')}</button>
        </nav>
      )}
    </header>
  );
}

function Pending() {
  const { user, refresh } = useMe();
  const { t } = useI18n();
  const logout = async () => {
    await api.post('/api/logout');
    refresh();
  };
  return (
    <div className="auth">
      <div className="card auth-card stack">
        <h2>{t('pending.title')}</h2>
        <p className="muted">{t('pending.text', { user: user.username })}</p>
        <button className="btn primary" onClick={refresh}>{t('pending.check')}</button>
        <button className="btn ghost" onClick={logout}>{t('nav.logout')}</button>
      </div>
    </div>
  );
}

function Footer() {
  const { version } = useMe();
  const { t, lang } = useI18n();
  const quotes = QUOTES[lang];
  const [i, setI] = useState(() => Math.floor(Math.random() * quotes.length));
  return (
    <footer className="footer container">
      {SHOW_QUOTES && (
        <p className="quote" onClick={() => setI((i + 1) % quotes.length)} title={t('footer.quoteHint')}>
          {quotes[i % quotes.length]}
        </p>
      )}
      <p className="muted small">
        {t('footer.note')} · <span>v{version}</span>
      </p>
    </footer>
  );
}
