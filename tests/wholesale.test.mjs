import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const fresh = async (t, opts) => { const w = world({ ...opts, env: { LISTING_AUTO_PUBLISH: '1', ...(opts && opts.env) } }); t.after(() => w.restore()); return w; };
const post = (w, s, n) => w.call('POST', '/api/market/listings', { as: s, body: { title: 'Item ' + n, description: 'fine', price: 100 + n, contact_phone: '0722000111' } });
async function deposit(w, u, amount) {
  const r = await w.call('POST', '/api/pay', { as: u, body: { purpose: 'topup', amount, phone: '0712345678' } });
  assert.equal(r.status, 200);
  const p = w.row('payments', (x) => x.id === r.data.id);
  assert.equal((await w.callback(p)).status, 200);
  return p;
}
const bal = async (w, u) => (await w.call('GET', '/api/wallet', { as: u })).data.balance;

test('deposit: a paid top-up lands in the wallet exactly once', async (t) => {
  const w = await fresh(t); const u = await w.user('u');
  const p = await deposit(w, u, 500);
  assert.equal(await bal(w, u), 500);
  await w.callback(p);
  assert.equal(await bal(w, u), 500, 'no double credit');
});

test('free sellers are capped; wholesaler membership (wallet) lifts the cap and renews by adding days', async (t) => {
  const w = await fresh(t, { env: { FREE_LISTING_LIMIT: '2' } }); const s = await w.user('s');
  assert.equal((await post(w, s, 1)).status, 201); assert.equal((await post(w, s, 2)).status, 201);
  const blocked = await post(w, s, 3); assert.equal(blocked.status, 402); assert.match(blocked.data.error, /wholesalers/i);
  let j = await w.call('POST', '/api/wholesale/join', { as: s, body: { method: 'wallet' } });
  assert.equal(j.status, 402, 'empty wallet cannot pay the fee');
  await deposit(w, s, 250);
  j = await w.call('POST', '/api/wholesale/join', { as: s, body: { method: 'wallet' } });
  assert.equal(j.status, 200); assert.equal(await bal(w, s), 150, 'KSh 100 taken');
  const first = Date.parse(j.data.until);
  assert.ok(Math.abs(first - (Date.now() + 30 * 86400e3)) < 60e3, '30 days');
  assert.equal((await post(w, s, 3)).status, 201, 'cap lifted');
  const j2 = await w.call('POST', '/api/wholesale/join', { as: s, body: { method: 'wallet' } });
  assert.ok(Math.abs(Date.parse(j2.data.until) - (first + 30 * 86400e3)) < 1e3, 'early renewal adds 30 days');
  const me = (await w.call('GET', '/api/wholesale/me', { as: s })).data;
  assert.equal(me.active, true); assert.equal(me.balance, 50);
  w.db.rows('profiles').find((p) => p.aid === s.aid).wholesaler_until = new Date(Date.now() - 1000).toISOString();
  assert.equal((await post(w, s, 4)).status, 402);
  assert.equal((await w.call('GET', '/api/wholesale/me', { as: s })).data.active, false);
});

test('wholesaler membership by M-Pesa activates when the payment is confirmed', async (t) => {
  const w = await fresh(t); const s = await w.user('s');
  const r = await w.call('POST', '/api/wholesale/join', { as: s, body: { method: 'mpesa', phone: '0712345678' } });
  assert.equal(r.status, 200); assert.equal(r.data.amount, 100);
  assert.equal((await w.call('GET', '/api/wholesale/me', { as: s })).data.active, false);
  await w.callback(w.row('payments', (x) => x.id === r.data.id));
  assert.equal((await w.call('GET', '/api/wholesale/me', { as: s })).data.active, true);
});

test('wallet purchase: money leaves the buyer wallet, order is held in escrow, no double spend', async (t) => {
  const w = await fresh(t); const seller = await w.user('sel'), buyer = await w.user('buy');
  const l = (await post(w, seller, 1)).data;
  let b = await w.call('POST', '/api/market/buy', { as: buyer, body: { listing_id: l.id, pay_with: 'wallet' } });
  assert.equal(b.status, 402, 'no balance');
  await deposit(w, buyer, 300);
  b = await w.call('POST', '/api/market/buy', { as: buyer, body: { listing_id: l.id, pay_with: 'wallet' } });
  assert.equal(b.status, 200); assert.equal(b.data.paid, 'wallet');
  assert.equal(await bal(w, buyer), 199);
  const o = w.row('orders', (x) => x.id === b.data.order_id);
  assert.equal(o.status, 'held'); assert.equal(o.buyer_aid, buyer.aid);
  const again = await w.call('POST', '/api/market/buy', { as: buyer, body: { listing_id: l.id, pay_with: 'wallet' } });
  assert.equal(again.status, 404, 'already sold');
  assert.equal(await bal(w, buyer), 199);
  assert.equal((await w.call('POST', `/api/orders/${o.id}/received`, { as: buyer })).status, 200);
  assert.equal(await bal(w, seller), 101 - 3);
});
