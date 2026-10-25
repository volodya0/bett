import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useMe } from '../App.jsx';
import { useI18n } from '../i18n.jsx';
import { toast } from '../ui.js';

export default function Auth() {
  const { refresh, inviteRequired, siteName } = useMe();
  const { t } = useI18n();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '', inviteCode: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post(mode === 'login' ? '/api/login' : '/api/register', form);
      if (mode === 'register') toast(t('auth.welcome'));
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="card auth-card">
        <div className="auth-ball">⚽</div>
        <h1>{siteName}</h1>
        <p className="muted">{t('auth.tagline')}</p>
        <div className="tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>{t('auth.login')}</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>{t('auth.register')}</button>
        </div>
        <form onSubmit={submit} className="stack">
          <label>
            {t('auth.username')}
            <input value={form.username} onChange={set('username')} autoComplete="username" required autoFocus />
          </label>
          <label>
            {t('auth.password')}
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </label>
          {mode === 'register' && inviteRequired && (
            <label>
              {t('auth.invite')}
              <input value={form.inviteCode} onChange={set('inviteCode')} required placeholder={t('auth.invitePlaceholder')} />
            </label>
          )}
          {error && <div className="error">{error}</div>}
          <button className="btn primary" disabled={busy}>
            {mode === 'login' ? t('auth.submitLogin') : t('auth.submitRegister')}
          </button>
        </form>
        <p className="small muted center">
          <Link to="/rules">{t('auth.howItWorks')}</Link>
        </p>
      </div>
    </div>
  );
}
