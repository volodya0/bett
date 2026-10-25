import { currentLang } from './i18n.jsx';

async function request(method, url, body) {
  const headers = { 'X-Lang': currentLang };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  put: (url, body = {}) => request('PUT', url, body),
  del: (url) => request('DELETE', url, {}),
};

// Points are stored in hundredths: 150 -> "1.5"
export const pts = (cents) => {
  const v = (cents || 0) / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '');
};

// Balance with an explicit sign: +3, −1.5, 0
export const signedPts = (cents) => (cents > 0 ? '+' : cents < 0 ? '−' : '') + pts(Math.abs(cents || 0));

export const fmtDate = (iso, locale) =>
  new Date(iso).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

