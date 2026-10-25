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

test('exact gets much more; the closest miss still joins so one player never takes all', () => {
  // actual 2:1 — only P1 hits a tier; P4 0:0 is distance 3, P2 3:0 is outcome (tier), P3 0:2 distance 3
  const r = settle({ predictions: [P(1, 2, 1), P(2, 3, 0), P(3, 0, 2), P(4, 0, 0)], actual: { home: 2, away: 1 }, stake: 100, bonus: 0, settings: S });
  const pay = payouts(r);
  assert.equal(r.pot, 400);
  assert.equal(pay[1] + pay[2] + pay[3] + pay[4], 400);
  assert.ok(pay[1] > 4 * pay[2]);
  assert.equal(pay[3], 0); // two players already reached a tier
  assert.equal(pay[4], 0);
});

test('a lone exact hit shares with the next closest', () => {
  // actual 2:1: P1 exact, P2 0:3 (distance 4), P3 0:4 (distance 5)
  const r = settle({ predictions: [P(1, 2, 1), P(2, 0, 3), P(3, 0, 4)], actual: { home: 2, away: 1 }, stake: 100, bonus: 0, settings: S });
  const pay = payouts(r);
  assert.equal(pay[1] + pay[2], 300);
  assert.equal(pay[3], 0);
  assert.ok(pay[2] > 0 && pay[1] > 9 * pay[2]);
  assert.equal(r.rows[1].tier, 'closest');
});

test('nobody in any tier → the two closest share, closer gets more', () => {
  // actual 4:0; 0:1 is distance 5, 0:2 distance 6, 1:5 distance 8
  const r = settle({ predictions: [P(1, 0, 2), P(2, 0, 1), P(3, 1, 5)], actual: { home: 4, away: 0 }, stake: 100, bonus: 0, settings: S });
  const pay = payouts(r);
  assert.equal(pay[1] + pay[2], 300);
  assert.equal(pay[3], 0);
  assert.ok(pay[2] > pay[1] && pay[1] > 0);
});

test('ties at the cut-off are all included and split evenly', () => {
  // actual 3:0; 0:2 and 1:3 are both distance 5, 0:5 is distance 8
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

test('the pot is never taken by one player when two or more bet', () => {
  for (let i = 0; i < 300; i++) {
    const n = 2 + (i % 5);
    const preds = Array.from({ length: n }, (_, k) => P(k + 1, (i * 7 + k * 3) % 5, (i * 3 + k * 5) % 4));
    const actual = { home: i % 4, away: (i >> 2) % 3 };
    const r = settle({ predictions: preds, actual, stake: 100, bonus: 0, settings: S });
    const paid = r.rows.filter((x) => x.payout > 0).length;
    assert.equal(r.rows.reduce((a, x) => a + x.payout, 0), n * 100);
    assert.ok(paid >= 2, `only ${paid} paid for case ${i}`);
  }
});
