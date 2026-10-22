import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
import { streakOf } from '../backend/src/engage.js';
const fresh = async (t, o) => { const w = world(o); t.after(() => w.restore()); return w; };
const day = (n) => new Date(Date.now() + 3 * 3600e3 - n * 864e5).toISOString().slice(0, 10);

test('streak maths: alive until the end of the next day, best run kept', () => {
  assert.deepEqual(streakOf(['2026-10-20', '2026-10-21', '2026-10-22'], '2026-10-22'), { current: 3, best: 3 });
  assert.deepEqual(streakOf(['2026-10-20', '2026-10-21'], '2026-10-22'), { current: 2, best: 2 }, 'yesterday still counts');
  assert.deepEqual(streakOf(['2026-10-18', '2026-10-19', '2026-10-20'], '2026-10-22'), { current: 0, best: 3 }, 'a missed day resets it');
  assert.deepEqual(streakOf(['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05'], '2026-10-05'), { current: 1, best: 3 }, 'month boundaries');
  assert.deepEqual(streakOf([], '2026-10-22'), { current: 0, best: 0 });
});

test('streak endpoint: counts past 8 days, shows the last 14, points at the next milestone', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  for (let i = 0; i < 9; i++) w.db.rows('points_ledger').push({ id: crypto.randomUUID(), aid: a.aid, delta: 2, kind: 'checkin', ref: 'r' + i, day: day(i) });
  const s = (await w.call('GET', '/api/streak', { as: a })).data;
  assert.equal(s.current, 9); assert.equal(s.checked_in, true); assert.equal(s.next, 14); assert.equal(s.to_next, 5);
  assert.equal(s.last14.length, 14); assert.equal(s.last14.filter((d) => d.done).length, 9); assert.equal(s.last14[13].done, true);
  assert.deepEqual(s.milestones.filter((m) => m.reached).map((m) => m.days), [3, 7]);
  assert.equal((await w.call('GET', '/api/streak')).status, 401);
});

test('market top: ranks sellers by finished sales, hides banned sellers, names nobody', async (t) => {
  const w = await fresh(t);
  const s1 = await w.user('s1'), s2 = await w.user('s2'), buyer = await w.user('b');
  for (const [seller, n] of [[s1, 3], [s2, 1]]) for (let i = 0; i < n; i++) { const lid = await w.approvedListing(seller, 500 + i, 'Item ' + i); const { order } = await w.buy(buyer, lid); order.status = 'released'; }
  const lid2 = await w.approvedListing(s2, 900, 'Still held'); await w.buy(buyer, lid2);                 // held, not counted
  const r = (await w.call('GET', '/api/market/top', { as: s2 })).data;
  assert.deepEqual(r.sellers.map((x) => x.sales), [3, 1]);
  assert.equal(r.sellers[1].mine, true); assert.equal(r.sellers[1].alias, 'You');
  assert.equal(r.total_sales, 4); assert.equal(r.categories[0].category, 'Electronics'); assert.equal(r.recent.length, 4);
  assert.ok(!JSON.stringify(r).includes(s1.aid) && !JSON.stringify(r).includes(s2.aid));
  await w.call('POST', `/api/admin/users/${s1.aid}`, { admin: true, body: { action: 'ban' } });
  assert.deepEqual((await w.call('GET', '/api/market/top')).data.sellers.map((x) => x.sales), [1]);
  assert.equal((await fresh(t)).call ? (await (await fresh(t)).call('GET', '/api/market/top')).data.total_sales : 0, 0, 'empty market is fine');
});

test('invite dashboard: funnel, earnings, people and your activity', async (t) => {
  const w = await fresh(t);
  const me = await w.user('me'), f1 = await w.user('f1'), f2 = await w.user('f2'), f3 = await w.user('f3'), seller = await w.user('seller');
  await w.call('POST', '/api/me/handle', { as: f1, body: { handle: 'Wanjiru' } });
  for (const f of [f1, f2, f3]) assert.equal((await w.call('POST', '/api/referral/attribute', { as: f, body: { code: me.code } })).status, 201);
  const empty = (await w.call('GET', '/api/referral/dashboard', { as: seller })).data;
  assert.equal(empty.funnel.invited, 0); assert.equal(empty.earnings.conversion, null);
  const lid = await w.approvedListing(seller, 800);
  await w.buy(f1, lid);                                                                             // f1 bought: reward is coming
  const lid2 = await w.approvedListing(seller, 700, 'Second'); const { order } = await w.buy(f2, lid2);
  const ref2 = w.row('referrals', (r) => r.referred_aid === f2.aid); ref2.status = 'unlocked';
  await w.call('POST', '/api/posts', { body: { aid: me.aid, content: 'My first story here', category: 'General' } });
  w.db.rows('points_ledger').push({ id: crypto.randomUUID(), aid: me.aid, delta: 2, kind: 'checkin', ref: 'x', day: day(0) });
  const d = (await w.call('GET', '/api/referral/dashboard', { as: me })).data;
  assert.deepEqual(d.funnel, { invited: 3, bought: 2, rewarded: 1, void: 0 });
  assert.equal(d.earnings.earned, 20); assert.equal(d.earnings.coming, 20); assert.equal(d.earnings.possible, 20); assert.equal(d.earnings.conversion, 67);
  assert.deepEqual(d.people.map((p) => p.stage).sort(), ['bought', 'joined', 'rewarded']);
  assert.ok(d.people.some((p) => p.name === 'Wanjiru'), 'a chosen username is shown');
  assert.ok(d.people.filter((p) => p.name !== 'Wanjiru').every((p) => /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(p.name)), 'others get an alias');
  assert.ok(!JSON.stringify(d).includes(f1.aid) && !JSON.stringify(d).includes(f3.aid));
  assert.equal(d.activity.parts.find((p) => p.key === 'posts').n, 1); assert.equal(d.activity.parts.find((p) => p.key === 'checkins').n, 1);
  assert.equal(d.activity.score, 4); assert.equal(d.activity.level, 'Just starting'); assert.equal(d.activity.last14.length, 14); assert.equal(d.activity.last14[13].n, 2);
  assert.equal((await w.call('GET', '/api/referral/dashboard')).status, 401);
});
