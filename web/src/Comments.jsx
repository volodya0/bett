import React, { useState } from 'react';
import { api } from './api.js';
import { useMe } from './App.jsx';
import { useI18n } from './i18n.jsx';

// Collapsible comment thread under a match. Loads lazily on first open.
export default function Comments({ matchId, count: initialCount = 0, defaultOpen = false }) {
  const { t, locale } = useI18n();
  const { user } = useMe();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(null);
  const [count, setCount] = useState(initialCount);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api.get(`/api/matches/${matchId}/comments`).then((l) => {
      setList(l);
      setCount(l.length);
    });

  const toggle = () => {
    if (!open && !list) load().catch((e) => setError(e.message));
    setOpen(!open);
  };
  // Open on mount when asked (e.g. on the match page).
  React.useEffect(() => {
    if (defaultOpen) toggle();
  }, []);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/matches/${matchId}/comments`, { text });
      setText('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c) => {
    if (!confirm(t('comments.confirmDelete'))) return;
    try {
      await api.del(`/api/comments/${c.id}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="comments">
      <button type="button" className="comments-toggle" onClick={toggle} aria-expanded={open}>
        {t('comments.button')} ({count}) <span className="chev">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="comments-body">
          {!list && !error && <div className="muted small">…</div>}
          {list?.length === 0 && <div className="muted small">{t('comments.empty')}</div>}
          {list?.map((c) => (
            <div key={c.id} className={'comment' + (c.mine ? ' mine' : '')}>
              <div className="comment-head">
                <b>{c.username}</b>
                <span className="muted small">{new Date(c.createdAt + 'Z').toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                {(c.mine || user?.isAdmin) && (
                  <button type="button" className="link danger small" onClick={() => remove(c)} title={t('comments.delete')}>×</button>
                )}
              </div>
              <div className="comment-text">{c.text}</div>
            </div>
          ))}
          {error && <div className="error">{error}</div>}
          <form className="comment-form" onSubmit={send}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('comments.placeholder')}
              rows={2}
              maxLength={1000}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(e);
              }}
            />
            <button className="btn primary small-btn" disabled={busy || !text.trim()}>{t('comments.send')}</button>
          </form>
        </div>
      )}
    </div>
  );
}
