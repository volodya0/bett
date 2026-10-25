// Pure pot-distribution logic — no DB, easy to test.

const sign = (n) => Math.sign(n);
const distance = (p, a) => Math.abs(p.home - a.home) + Math.abs(p.away - a.away);

// How close a prediction is to the actual score.
export function tierOf(pred, actual) {
  const { home: ph, away: pa } = pred;
  const { home: h, away: a } = actual;
  if (ph === h && pa === a) return 'exact';
  const sameOutcome = sign(ph - pa) === sign(h - a);
  if (sameOutcome && ph - pa === h - a) return 'diff';
  if (sameOutcome) return 'outcome';
  if (distance(pred, actual) <= 1) return 'near';
  return null;
}

export function weightOf(tier, s) {
  return { exact: s.wExact, diff: s.wDiff, outcome: s.wOutcome, near: s.wNear, closest: 1 }[tier] || 0;
}

// Splits `total` cents proportionally to weights. Rounding leftovers
// go 1 cent at a time to the highest weights.
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
 * Computes the settlement of a match. The whole pot is always paid out:
 * if no prediction reaches any tier, the closest prediction(s) by total
 * goal distance share it.
 * predictions: [{ id, user_id, home, away }]
 * Returns { pot, rows: [{ id, user_id, tier, payout }] }
 */
export function settle({ predictions, actual, stake, bonus, settings }) {
  const pot = stake * predictions.length + bonus;
  const rows = predictions.map((p) => ({ id: p.id, user_id: p.user_id, tier: tierOf(p, actual), payout: 0 }));
  if (!rows.length) return { pot, rows };

  if (!rows.some((r) => weightOf(r.tier, settings) > 0)) {
    const dists = predictions.map((p) => distance(p, actual));
    const best = Math.min(...dists);
    rows.forEach((r, i) => (r.tier = dists[i] === best ? 'closest' : null));
  }

  const weights = rows.map((r) => weightOf(r.tier, settings));
  splitProportional(pot, weights).forEach((p, i) => (rows[i].payout = p));
  return { pot, rows };
}
