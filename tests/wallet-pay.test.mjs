import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const fresh = async (t, opts) => { const w = world(opts); t.after(() => w.restore()); return w; };
async function deposit(w, u, amount) {
  const r = await w.call('POST', '/api/pay', { as: u, body: { purpose: 'topup', amount, phone: '0712345678' } });
  assert.equal(r.status, 200);
  assert.equal((await w.callback(w.row('payments', (x) => x.id === r.data.id))).status, 200);
}
const bal = async (w, u) => (await w.call('GET', '/api/wallet', { as: u })).data.balance;

test('wallet pay: a boost is paid from the wallet, never from a deposit, and a short wallet is refused', async (t) => {
  const w = await fresh(t); const a = await w.user('a');
  const p = await w.call('POST', '/api/posts', { body: { aid: a.aid, content: 'Selling stuff cheap', category: 'General' } });
  const id = p.data.id || p.data.post?.id || w.db.rows('posts')[0].id;
  const pay = () => w.call('POST', '/api/pay', { as: a, body: { purpose: 'boost', ref_id: id, pay_with: 'wallet' } });
  assert.equal((await pay()).status, 402, 'empty wallet');
  assert.equal((await w.call('POST', '/api/pay', { as: a, body: { purpose: 'topup', amount: 50, pay_with: 'wallet' } })).status, 400, 'a deposit cannot come from the wallet');
  await deposit(w, a, 200);
  const r = await pay();
  assert.equal(r.status, 200); assert.equal(r.data.paid, 'wallet');
  assert.ok(Date.parse(w.row('posts', (x) => x.id === id).boosted_until) > Date.now(), 'boost is on');
  assert.ok((await bal(w, a)) < 200, 'money left the wallet');
  const pr = w.row('payments', (x) => x.id === r.data.id);
  assert.equal(pr.status, 'paid'); assert.equal(pr.phone, 'wallet');
});

test('wallet pay: a ticket is issued once and the exact price leaves the wallet', async (t) => {
  const w = await fresh(t); const a = await w.user('a');
  const next = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  const ev = { id: crypto.randomUUID(), title: 'Career fair', starts_on: next, venue: 'Hall', hidden: false, ticket_price: 300, created_at: new Date().toISOString() };
  w.db.rows('events').push(ev);
  const buy = () => w.call('POST', '/api/tickets/buy', { as: a, body: { event_id: ev.id, method: 'wallet' } });
  assert.equal((await buy()).status, 402, 'empty wallet');
  assert.equal(w.db.rows('tickets').length, 0);
  await deposit(w, a, 500);
  const r = await buy();
  assert.equal(r.status, 201); assert.equal(r.data.paid, 'wallet');
  assert.equal(await bal(w, a), 200);
  assert.equal(w.db.rows('tickets').filter((x) => x.aid === a.aid).length, 1);
  assert.equal((await buy()).status, 402, 'KSh 200 left is not enough for a second ticket');
  assert.equal(w.db.rows('tickets').length, 1);
});

test('wallet pay: a club order is paid from the wallet; a short wallet gives the stock back', async (t) => {
  const w = await fresh(t); const a = await w.user('a');
  const p = await w.call('POST', '/api/admin/club/products', { admin: true, body: { name: 'Club hoodie', price: 1500, qty: 1 } });
  await w.call('POST', '/api/club/join', { as: a, body: { display_name: 'Member' } });
  const order = () => w.call('POST', '/api/club/order', { as: a, body: { product_id: p.data.id, qty: 1, pay_with: 'wallet' } });
  assert.equal((await order()).status, 402);
  assert.equal((await w.call('GET', '/api/club/products')).data.products[0].stock, 1, 'stock restored after the refusal');
  await deposit(w, a, 2000);
  const r = await order();
  assert.equal(r.status, 201); assert.equal(r.data.paid, 'wallet');
  assert.equal(await bal(w, a), 500);
  assert.equal(w.row('club_orders', (x) => x.id === r.data.order_id).status, 'paid');
  assert.equal((await w.call('GET', '/api/club/products')).data.products[0].stock, 0);
});
