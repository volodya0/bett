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
  return { exact: s.wExact, diff: s.wDiff, outcome: s.wOutcome, near: s.wNear }[tier] || 0;
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

export const MIN_WINNERS = 2;

/**
 * Computes the settlement of a match. The whole pot is always paid out and
 * always shared by at least two players (when at least two took part):
 * predictions that reach a tier share it by tier weight, and if fewer than
 * two did, the next closest predictions by total goal error join in with a
 * weight no bigger than "near", scaled down the further off they are.
 * predictions: [{ id, user_id, home, away }]
 * Returns { pot, rows: [{ id, user_id, tier, payout }] }
 */
export function settle({ predictions, actual, stake, bonus, settings }) {
  const pot = stake * predictions.length + bonus;
  const rows = predictions.map((p) => ({
    id: p.id,
    user_id: p.user_id,
    tier: tierOf(p, actual),
    dist: distance(p, actual),
    weight: 0,
    payout: 0,
  }));
  if (!rows.length) return { pot, rows: [] };

  rows.forEach((r) => (r.weight = weightOf(r.tier, settings)));
  const winners = rows.filter((r) => r.weight > 0).length;

  const need = Math.min(MIN_WINNERS, rows.length);
  if (winners < need) {
    // Closest of the rest by goal distance; ties at the cut-off are all included.
    const rest = rows.filter((r) => r.weight === 0).sort((a, b) => a.dist - b.dist);
    const cutoff = rest[need - winners - 1].dist;
    const joiners = rest.filter((r) => r.dist <= cutoff);
    const base = settings.wNear > 0 ? settings.wNear : 1;
    const minDist = Math.max(1, joiners[0].dist);
    for (const r of joiners) {
      r.tier = 'closest';
      r.weight = (base * minDist) / Math.max(1, r.dist);
    }
  }

  splitProportional(
    pot,
    rows.map((r) => r.weight)
  ).forEach((p, i) => (rows[i].payout = p));
  return { pot, rows: rows.map(({ id, user_id, tier, payout }) => ({ id, user_id, tier, payout })) };
}
