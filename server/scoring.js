// Чиста логіка розподілу банку — без БД, щоб легко тестувати.

const sign = (n) => Math.sign(n);

// Наскільки прогноз близький до фактичного рахунку.
export function tierOf(pred, actual) {
  const { home: ph, away: pa } = pred;
  const { home: h, away: a } = actual;
  if (ph === h && pa === a) return 'exact';
  const sameOutcome = sign(ph - pa) === sign(h - a);
  if (sameOutcome && ph - pa === h - a) return 'diff';
  if (sameOutcome) return 'outcome';
  if (Math.abs(ph - h) + Math.abs(pa - a) <= 1) return 'near';
  return null;
}

export const TIER_LABELS = {
  exact: 'Точний рахунок',
  diff: 'Результат + різниця',
  outcome: 'Результат',
  near: 'Майже (±1 гол)',
};

export function weightOf(tier, s) {
  return { exact: s.wExact, diff: s.wDiff, outcome: s.wOutcome, near: s.wNear }[tier] || 0;
}

// Ділить `total` центів пропорційно вагам. Залишок від округлення
// роздаємо по 1 центу тим, у кого найбільша вага.
export function splitProportional(total, weights) {
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (sumW <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sumW);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r), w: weights[i] }))
    .filter((x) => x.w > 0)
    .sort((x, y) => y.w - x.w || y.frac - x.frac || x.i - y.i);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k].i]++;
  return out;
}

/**
 * Рахує результат матчу.
 * predictions: [{ id, user_id, home, away }]
 * Повертає { pot, rows: [{id,user_id,tier,payout,refund}], jackpotIn, jackpotOut }
 */
export function settle({ predictions, actual, stake, bonus, jackpot, settings }) {
  const pot = stake * predictions.length + bonus;
  const rows = predictions.map((p) => ({
    id: p.id,
    user_id: p.user_id,
    tier: tierOf(p, actual),
    payout: 0,
    refund: 0,
  }));
  const weights = rows.map((r) => weightOf(r.tier, settings));
  const anyWinner = weights.some((w) => w > 0);

  if (!predictions.length) return { pot, rows, jackpotIn: 0, jackpotOut: 0 };

  if (!anyWinner) {
    if (settings.noWinnerPolicy === 'refund') {
      rows.forEach((r) => (r.refund = stake));
      return { pot, rows, jackpotIn: 0, jackpotOut: 0 };
    }
    return { pot, rows, jackpotIn: pot, jackpotOut: 0 };
  }

  splitProportional(pot, weights).forEach((p, i) => (rows[i].payout = p));

  // Джекпот забирають лише ті, хто вгадав точний рахунок.
  let jackpotOut = 0;
  const exactIdx = rows.map((r, i) => (r.tier === 'exact' ? i : -1)).filter((i) => i >= 0);
  if (jackpot > 0 && exactIdx.length) {
    const shares = splitProportional(jackpot, exactIdx.map(() => 1));
    exactIdx.forEach((idx, k) => (rows[idx].payout += shares[k]));
    jackpotOut = jackpot;
  }
  return { pot, rows, jackpotIn: 0, jackpotOut };
}
