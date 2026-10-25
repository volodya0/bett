import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settle, splitProportional, tierOf } from './scoring.js';

const S = { wExact: 10, wDiff: 4, wOutcome: 2, wNear: 1 };
const P = (id, home, away) => ({ id, user_id: id, home, away });
const payouts = (r) => Object.fromEntries(r.rows.map((x) => [x.user_id, x.payout]));

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
  assert.equal(splitProportional(100, [1, 1, 1]).reduce((a, b) => a + b), 100);
  assert.equal(splitProportional(500, [10, 0, 2, 0]).reduce((a, b) => a + b), 500);
});

test('exact gets much more, misses get nothing, pot conserved', () => {
  const r = settle({ predictions: [P(1, 2, 1), P(2, 3, 0), P(3, 0, 2), P(4, 0, 0)], actual: { home: 2, away: 1 }, stake: 100, bonus: 0, settings: S });
  const pay = payouts(r);
  assert.equal(r.pot, 400);
  assert.equal(pay[1] + pay[2], 400);
  assert.ok(pay[1] > 4 * pay[2]);
  assert.equal(pay[3], 0);
  assert.equal(pay[4], 0);
});

test('nobody in any tier → closest by goal distance takes the whole pot', () => {
  // actual 4:0; 0:2 is distance 6, 0:1 is distance 5, 1:3 is distance 6
  const r = settle({ predictions: [P(1, 0, 2), P(2, 0, 1), P(3, 1, 3)], actual: { home: 4, away: 0 }, stake: 100, bonus: 50, settings: S });
  const pay = payouts(r);
  assert.deepEqual(pay, { 1: 0, 2: 350, 3: 0 });
  assert.equal(r.rows[1].tier, 'closest');
});

test('ties for closest split the pot evenly', () => {
  const r = settle({ predictions: [P(1, 0, 2), P(2, 1, 3), P(3, 0, 5)], actual: { home: 3, away: 0 }, stake: 100, bonus: 0, settings: S });
  const pay = payouts(r);
  assert.equal(pay[1], 150);
  assert.equal(pay[2], 150);
  assert.equal(pay[3], 0);
});

test('single participant gets the stake back', () => {
  const r = settle({ predictions: [P(1, 0, 3)], actual: { home: 3, away: 0 }, stake: 100, bonus: 0, settings: S });
  assert.equal(r.rows[0].payout, 100);
});
