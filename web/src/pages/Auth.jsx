import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useMe } from '../App.jsx';
import { famousNameQuip, nightQuip, toast } from '../eggs.js';

export default function Auth() {
  const { refresh, inviteRequired, siteName } = useMe();
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
      const quip = (mode === 'register' && famousNameQuip(form.username)) || nightQuip();
      if (quip) toast(quip);
      else if (mode === 'register') toast('Ласкаво просимо в гру! Стартові бали вже на рахунку 💰');
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
        <p className="muted">Вгадуй рахунки, забирай бали, хизуйся перед кумами.</p>
        <div className="tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Вхід</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Реєстрація</button>
        </div>
        <form onSubmit={submit} className="stack">
          <label>
            Логін
            <input value={form.username} onChange={set('username')} autoComplete="username" required autoFocus />
          </label>
          <label>
            Пароль
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
              Код запрошення
              <input value={form.inviteCode} onChange={set('inviteCode')} required placeholder="спитай у адміна" />
            </label>
          )}
          {error && <div className="error">{error}</div>}
          <button className="btn primary" disabled={busy}>
            {mode === 'login' ? 'Увійти' : 'Зареєструватися'}
          </button>
        </form>
        <p className="small muted center">
          <Link to="/rules">Як це працює?</Link>
        </p>
      </div>
    </div>
  );
}
