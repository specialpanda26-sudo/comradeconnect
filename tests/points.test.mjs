// Points: server-owned, capped per day, spendable only on Market items and only up to the platform fee.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const fresh = async (t) => { const w = world(); t.after(() => w.restore()); return w; };
const give = (w, aid, n) => w.db.rows('points_ledger').push({ id: crypto.randomUUID(), aid, delta: n, kind: 'checkin', ref: 'seed:' + aid + n, day: '2000-01-01' });
const pts = async (w, u) => (await w.call('GET', '/api/points', { as: u })).data.points;
const buyWith = async (w, b, listing, use_points) => {
  const r = await w.call('POST', '/api/market/buy', { as: b, body: { listing_id: listing, phone: '0712345678', use_points } });
  const payment = w.row('payments', (p) => p.id === r.data.id);
  return { r, payment };
};

test('check-in is awarded by the server once a day, and the phone cannot add points', async (t) => {
  const w = await fresh(t); const a = await w.user('a');
  assert.equal((await w.call('POST', '/api/points/checkin', { as: a, body: {} })).data.awarded, 2);
  assert.equal((await w.call('POST', '/api/points/checkin', { as: a, body: {} })).status, 409);
  assert.equal(await pts(w, a), 2);
  assert.equal((await w.call('POST', '/api/points/earn', { as: a, body: { points: 9999 } })).status, 404, 'no endpoint lets a phone choose its points');
});

test('points cover only the platform fee: KSh 1000 item, 3% fee = KSh 30 max, seller still gets 970', async (t) => {
  const w = await fresh(t); const s = await w.user('s'), b = await w.user('b');
  give(w, b.aid, 1000);                                      // worth KSh 100, but only the KSh 30 fee can be covered
  const listing = await w.approvedListing(s, 1000);
  const { r, payment } = await buyWith(w, b, listing, true);
  assert.equal(r.data.credit, 30); assert.equal(r.data.amount, 970); assert.equal(payment.amount, 970);
  assert.equal(await pts(w, b), 700, '300 points spent');
  await w.callback(payment);
  const o = w.row('orders', (x) => x.payment_id === payment.id);
  assert.equal(o.amount, 1000); assert.equal(o.fee, 30); assert.equal(o.seller_amount, 970); assert.equal(o.credit_ksh, 30);
});

test('small item: KSh 100 with a 3% fee only allows KSh 3 of credit', async (t) => {
  const w = await fresh(t); const s = await w.user('s'), b = await w.user('b');
  give(w, b.aid, 500);
  const { r } = await buyWith(w, b, await w.approvedListing(s, 100), true);
  assert.equal(r.data.credit, 3); assert.equal(r.data.amount, 97); assert.equal(await pts(w, b), 470);
});

test('only whole shillings the buyer can afford are used; no points means no credit', async (t) => {
  const w = await fresh(t); const s = await w.user('s'), b = await w.user('b');
  give(w, b.aid, 25);                                        // KSh 2.5, so KSh 2
  const { r } = await buyWith(w, b, await w.approvedListing(s, 1000), true);
  assert.equal(r.data.credit, 2); assert.equal(await pts(w, b), 5);
  const b2 = await w.user('b2');
  const none = await buyWith(w, b2, await w.approvedListing(s, 1000, 'Other'), true);
  assert.equal(none.r.data.credit, 0); assert.equal(none.r.data.amount, 1000);
});

test('a failed or expired payment returns the points, once', async (t) => {
  const w = await fresh(t); const s = await w.user('s'), b = await w.user('b');
  give(w, b.aid, 300);
  const { payment } = await buyWith(w, b, await w.approvedListing(s, 1000), true);
  assert.equal(await pts(w, b), 0);
  await w.callback(payment, { code: 1032 });
  assert.equal(await pts(w, b), 300);
  await w.callback(payment, { code: 1032 });
  assert.equal(await pts(w, b), 300, 'not returned twice');
});

test('refund: cash part goes to the wallet, points go back, platform pays out nothing extra', async (t) => {
  const w = await fresh(t); const s = await w.user('s'), b = await w.user('b');
  give(w, b.aid, 300);
  const { payment } = await buyWith(w, b, await w.approvedListing(s, 1000), true);
  await w.callback(payment);
  const o = w.row('orders', (x) => x.payment_id === payment.id);
  assert.equal((await w.call('POST', `/api/admin/orders/${o.id}`, { admin: true, body: { action: 'refund' } })).status, 200);
  assert.equal((await w.call('GET', '/api/me', { as: b })).data.balance, 970, 'only the cash KSh 970 returns as money');
  assert.equal(await pts(w, b), 300, 'the points come back as points');
});

test('release: seller and buyer earn points, but never beyond the daily cap', async (t) => {
  const w = await fresh(t); const s = await w.user('s'), b = await w.user('b');
  const { order } = await w.buy(b, await w.approvedListing(s, 1000));
  await w.call('POST', `/api/orders/${order.id}/received`, { as: b });
  assert.equal(await pts(w, s), 10); assert.equal(await pts(w, b), 5);
  w.db.rows('points_ledger').push({ id: crypto.randomUUID(), aid: s.aid, delta: 25, kind: 'sale', ref: 'x', day: new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10) });
  const { order: o2 } = await w.buy(b, await w.approvedListing(s, 500, 'Second'));
  await w.call('POST', `/api/orders/${o2.id}/received`, { as: b });
  assert.equal(await pts(w, s), 35, 'already over the daily cap of 30, so nothing more is added');
});

test('seller can withdraw as little as KSh 1', async (t) => {
  const w = await fresh(t); const s = await w.user('s'), b = await w.user('b');
  const { order } = await w.buy(b, await w.approvedListing(s, 1000));
  await w.call('POST', `/api/orders/${order.id}/received`, { as: b });
  await w.call('POST', '/api/me/handle', { as: s, body: { handle: 'Seller_One' } });
  w.row('profiles', (p) => p.aid === s.aid).verified = true;
  assert.equal((await w.call('POST', '/api/wallet/withdraw', { as: s, body: { amount: 1, phone: '0700111222' } })).status, 201);
  assert.equal((await w.call('POST', '/api/wallet/withdraw', { as: s, body: { amount: 0, phone: '0700111222' } })).status, 400);
});
