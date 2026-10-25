import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settle, splitProportional, tierOf } from './scoring.js';

const S = { wExact: 10, wDiff: 4, wOutcome: 2, wNear: 1, noWinnerPolicy: 'jackpot' };
const P = (id, home, away) => ({ id, user_id: id, home, away });

test('tiers', () => {
  const a = { home: 2, away: 1 };
  assert.equal(tierOf({ home: 2, away: 1 }, a), 'exact');
  assert.equal(tierOf({ home: 3, away: 2 }, a), 'diff');
  assert.equal(tierOf({ home: 1, away: 0 }, a), 'diff');
  assert.equal(tierOf({ home: 4, away: 1 }, a), 'outcome');
  assert.equal(tierOf({ home: 1, away: 1 }, a), 'near');
  assert.equal(tierOf({ home: 2, away: 2 }, a), 'near');
  assert.equal(tierOf({ home: 0, away: 3 }, a), null);
  assert.equal(tierOf({ home: 2, away: 2 }, { home: 1, away: 1 }), 'diff');
});

test('split keeps every cent', () => {
  const out = splitProportional(100, [1, 1, 1]);
  assert.equal(out.reduce((a, b) => a + b), 100);
  assert.deepEqual(splitProportional(500, [10, 0, 2, 0]).reduce((a, b) => a + b), 500);
});

test('exact gets much more, losers get nothing, pot conserved', () => {
  const r = settle({ predictions: [P(1, 2, 1), P(2, 3, 0), P(3, 0, 2), P(4, 0, 0)], actual: { home: 2, away: 1 }, stake: 100, bonus: 0, jackpot: 0, settings: S });
  const pay = Object.fromEntries(r.rows.map((x) => [x.user_id, x.payout]));
  assert.equal(r.pot, 400);
  assert.equal(pay[1] + pay[2], 400);
  assert.ok(pay[1] > 4 * pay[2]);
  assert.equal(pay[3], 0);
  assert.equal(pay[4], 0);
});

test('no winners → jackpot, then exact winner takes jackpot', () => {
  const r1 = settle({ predictions: [P(1, 0, 3), P(2, 0, 4)], actual: { home: 3, away: 0 }, stake: 100, bonus: 50, jackpot: 0, settings: S });
  assert.equal(r1.jackpotIn, 250);
  const r2 = settle({ predictions: [P(1, 1, 0), P(2, 2, 0)], actual: { home: 1, away: 0 }, stake: 100, bonus: 0, jackpot: 250, settings: S });
  assert.equal(r2.jackpotOut, 250);
  const pay = Object.fromEntries(r2.rows.map((x) => [x.user_id, x.payout]));
  assert.equal(pay[1] + pay[2], 450);
  assert.ok(pay[1] > 250);
});

test('no winners with refund policy', () => {
  const r = settle({ predictions: [P(1, 0, 3)], actual: { home: 3, away: 0 }, stake: 100, bonus: 0, jackpot: 0, settings: { ...S, noWinnerPolicy: 'refund' } });
  assert.equal(r.rows[0].refund, 100);
  assert.equal(r.jackpotIn, 0);
});
