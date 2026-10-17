// Money settings: fee %, boost prices, payout fees, earnings, cancel, sponsors. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const fresh = async (t, opts) => { const w = world(opts); t.after(() => w.restore()); return w; };
const save = (w, values) => w.call('POST', '/api/admin/settings', { admin: true, body: { values } });

test('settings: admin only, validated, public config follows, every change audited', async (t) => {
  const w = await fresh(t);
  assert.equal((await w.call('POST', '/api/admin/settings', { body: { values: { platform_fee_percent: 5 } } })).status, 403);
  assert.equal((await w.call('GET', '/api/config')).data.fee_percent, 3, 'falls back to env');
  for (const bad of [{ platform_fee_percent: 90 }, { platform_fee_percent: '' }, { boost_price: 0 }, { boost_price: 12.5 }, { withdraw_min: 10 }, { nope: 1 }])
    assert.equal((await save(w, bad)).status, 400, JSON.stringify(bad));
  assert.equal((await save(w, { platform_fee_percent: 7.5, boost_price: 40, boost_price_3d: 90, withdraw_fee_flat: 10 })).status, 200);
  const c = (await w.call('GET', '/api/config')).data;
  assert.equal(c.fee_percent, 7.5); assert.equal(c.boost_plans[0].price, 40); assert.equal(c.boost_plans[1].price, 90); assert.equal(c.withdraw_fee_flat, 10);
  assert.ok(w.db.rows('admin_audit_log').some((r) => r.action === 'settings.update'));
  assert.equal((await save(w, { withdraw_fee_flat: 500, withdraw_min: 50 })).status, 400, 'fee may not swallow the smallest withdrawal');
});

test('fee change applies to new orders only; old orders keep their fee', async (t) => {
  const w = await fresh(t);
  const s = await w.user('s'), b = await w.user('b');
  const l1 = await w.approvedListing(s, 1000), l2 = await w.approvedListing(s, 1000, 'Second item');
  const first = await w.buy(b, l1);
  assert.equal(first.order.fee, 30);
  await save(w, { platform_fee_percent: 10 });
  const second = await w.buy(b, l2);
  assert.equal(second.order.fee, 100); assert.equal(second.order.seller_amount, 900);
  assert.equal(w.row('orders', (o) => o.id === first.order.id).fee, 30, 'old order untouched');
  assert.equal((await w.call('GET', '/api/orders/mine', { as: b })).status, 200);
});

test('boost: 3-day plan uses the server price and adds time to a running boost', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const p = await w.call('POST', '/api/posts', { body: { aid: a.aid, content: 'Selling stuff cheap', category: 'General' } });
  const id = p.data.id || p.data.post?.id || w.db.rows('posts')[0].id;
  await save(w, { boost_price_3d: 95 });
  const r = await w.call('POST', '/api/pay', { as: a, body: { purpose: 'boost', ref_id: id, plan: '3d', amount: 1, phone: '0712987654' } });
  const pay = w.row('payments', (x) => x.id === r.data.id);
  assert.equal(pay.amount, 95); assert.equal(pay.boost_hours, 72);
  await w.callback(pay);
  const until1 = Date.parse(w.row('posts', (x) => x.id === id).boosted_until);
  assert.ok(until1 > Date.now() + 71 * 3600e3);
  const r2 = await w.call('POST', '/api/pay', { as: a, body: { purpose: 'boost', ref_id: id, plan: '1d', phone: '0712987655' } });
  await w.callback(w.row('payments', (x) => x.id === r2.data.id));
  assert.ok(Date.parse(w.row('posts', (x) => x.id === id).boosted_until) > until1 + 23 * 3600e3, 'second boost stacks');
});

test('payout: fee, minimum, cancel, no double code, history and earnings', async (t) => {
  const w = await fresh(t);
  const s = await w.user('s'), b = await w.user('b');
  await w.call('POST', '/api/admin/users/' + s.aid, { admin: true, body: { action: 'role', role: 'seller' } });
  w.row('profiles', (p) => p.aid === s.aid).verified = true;
  const l = await w.approvedListing(s, 2000), { order } = await w.buy(b, l);
  await w.call('POST', `/api/orders/${order.id}/handed`, { as: s });
  assert.equal((await w.call('POST', `/api/orders/${order.id}/received`, { as: b })).status, 200);
  assert.equal((await w.call('GET', '/api/wallet', { as: s })).data.balance, 1940);
  await save(w, { withdraw_fee_percent: 2, withdraw_fee_flat: 5, withdraw_min: 100 });
  assert.equal((await w.call('POST', '/api/wallet/withdraw', { as: s, body: { amount: 80, phone: '0712345678' } })).status, 400, 'below minimum');
  const wd = await w.call('POST', '/api/wallet/withdraw', { as: s, body: { amount: 1000, phone: '0712345678' } });
  assert.equal(wd.status, 201); assert.equal(wd.data.fee, 25); assert.equal(wd.data.net, 975);
  assert.equal((await w.call('GET', '/api/wallet', { as: s })).data.balance, 940);
  // cancel: money returns once, a second cancel is refused
  assert.equal((await w.call('POST', `/api/wallet/withdraw/${wd.data.id}/cancel`, { as: s })).status, 200);
  assert.equal((await w.call('POST', `/api/wallet/withdraw/${wd.data.id}/cancel`, { as: s })).status, 409);
  assert.equal((await w.call('GET', '/api/wallet', { as: s })).data.balance, 1940);
  // pay one out; the same M-Pesa code cannot close another
  const w1 = await w.call('POST', '/api/wallet/withdraw', { as: s, body: { amount: 500, phone: '0712345678' } });
  const w2 = await w.call('POST', '/api/wallet/withdraw', { as: s, body: { amount: 600, phone: '0712345678' } });
  assert.equal((await w.call('POST', `/api/admin/withdrawals/${w1.data.id}`, { admin: true, body: { action: 'paid', payout_ref: 'SJK7ABC123' } })).status, 200);
  assert.equal((await w.call('POST', `/api/admin/withdrawals/${w2.data.id}`, { admin: true, body: { action: 'paid', payout_ref: 'SJK7ABC123' } })).status, 409);
  assert.equal((await w.call('POST', `/api/wallet/withdraw/${w1.data.id}/cancel`, { as: s })).status, 409, 'paid cannot be cancelled');
  const hist = (await w.call('GET', '/api/admin/payouts?status=paid', { admin: true })).data.payouts;
  assert.equal(hist.length, 1); assert.equal(hist[0].net, 485);
  const e = (await w.call('GET', '/api/admin/earnings', { admin: true })).data;
  assert.equal(e.market_fees.total, 60); assert.equal(e.withdrawal_fees.total, 15); assert.equal(e.paid_out, 485);
  assert.equal(e.owed_to_sellers, 600 - 17); assert.equal(e.total_earned, 75);
});

test('sponsors: amount, end date, pause, edit; notices and events can be edited', async (t) => {
  const w = await fresh(t);
  const sp = await w.call('POST', '/api/admin/sponsors', { admin: true, body: { name: 'Acme', blurb: 'Deals', link: 'https://acme.co.ke', amount: 5000, ends_on: '2099-12-31' } });
  assert.equal(sp.status, 201); assert.equal(sp.data.amount, 5000);
  assert.equal((await w.call('POST', '/api/admin/sponsors', { admin: true, body: { name: 'Bad', amount: 'x' } })).status, 400);
  const up = (id, body) => w.call('POST', `/api/admin/sponsors/${id}`, { admin: true, body: { action: 'update', ...body } });
  assert.equal((await up(sp.data.id, { amount: 7000, name: 'Acme Ltd' })).status, 200);
  assert.equal((await up(sp.data.id, { link: 'http://evil' })).status, 400);
  assert.equal((await up(sp.data.id, { active: false })).status, 200);
  assert.equal((await w.call('GET', '/api/sponsors')).data.sponsors.length, 0, 'paused is hidden from students');
  const all = (await w.call('GET', '/api/admin/sponsors', { admin: true })).data.sponsors;
  assert.equal(all.length, 1); assert.equal(all[0].amount, 7000); assert.equal(all[0].name, 'Acme Ltd');
  const n = await w.call('POST', '/api/admin/notices', { admin: true, body: { title: 'Exams out', body: 'Check portal' } });
  assert.equal((await w.call('POST', `/api/admin/notices/${n.data.id}`, { admin: true, body: { action: 'update', title: 'Exams moved', pinned: true } })).status, 200);
  assert.equal(w.row('notices', (x) => x.id === n.data.id).title, 'Exams moved');
  const ev = await w.call('POST', '/api/admin/events', { admin: true, body: { title: 'Bash', date: '2099-01-01', ticket_price: 200 } });
  assert.equal((await w.call('POST', `/api/admin/events/${ev.data.id}`, { admin: true, body: { action: 'update', ticket_price: '' } })).status, 200);
  assert.equal(w.row('events', (x) => x.id === ev.data.id).ticket_price, null);
  assert.equal((await w.call('POST', `/api/admin/events/${ev.data.id}`, { admin: true, body: { action: 'update', date: '2099-13-45' } })).status, 400);
});
