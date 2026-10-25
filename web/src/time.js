import { useEffect, useState } from 'react';

export function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const UNITS = { uk: ['д', 'год', 'хв'], en: ['d', 'h', 'min'] };

export function countdown(iso, now, lang) {
  const diff = Date.parse(iso) - now;
  if (diff <= 0) return null;
  const [dU, hU, mU] = UNITS[lang];
  const m = Math.floor(diff / 60000);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d) return `${d} ${dU} ${h} ${hU}`;
  if (h) return `${h} ${hU} ${mm} ${mU}`;
  return `${mm} ${mU}`;
}
