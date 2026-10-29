import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const items = async (w, u) => (await w.call('GET', '/api/notifications', { as: u })).data.items;
const has = (list, title, text) => list.some((n) => n.title.includes(title) && (!text || String(n.body).includes(text)));
const pay = async (w, u, body) => { const r = await w.call('POST', '/api/pay', { as: u, body: { phone: '0712345678', ...body } }); return w.row('payments', (x) => x.id === r.data.id); };

test('deposit: the person is told, once, when the money lands', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('dep'), p = await pay(w, u, { purpose: 'topup', amount: 50 });
  await w.callback(p, { receipt: 'SJK1ABC123' }); await w.callback(p, { receipt: 'SJK1ABC123' });
  const l = (await items(w, u)).filter((n) => n.title === 'Deposit received');
  assert.equal(l.length, 1); assert.ok(l[0].body.includes('KSh 50'));
});

test('a failed payment is announced', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('fail'), p = await pay(w, u, { purpose: 'topup', amount: 50 });
  await w.callback(p, { code: 1 });
  assert.ok(has(await items(w, u), 'Payment not completed', 'KSh 50'));
});

test('withdraw: asked and cancelled both show in the bell', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('wd'); w.row('profiles', (p) => p.aid === u.aid).verified = true;
  w.db.rows('wallet_ledger').push({ id: crypto.randomUUID(), aid: u.aid, delta: 500, kind: 'topup', ref: 'seed', status: 'available' });
  const r = await w.call('POST', '/api/wallet/withdraw', { as: u, body: { amount: 100, phone: '0700111222' } });
  assert.equal(r.status, 201);
  assert.ok(has(await items(w, u), 'Withdrawal requested', '0700111222'));
  const c = await w.call('POST', '/api/wallet/withdraw/' + r.data.id + '/cancel', { as: u });
  assert.equal(c.status, 200);
  assert.ok(has(await items(w, u), 'Withdrawal cancelled', 'KSh 100'));
});

test('admin wallet grant tells the person', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('gr');
  const r = await w.call('POST', '/api/admin/wallet/grant', { admin: true, body: { to: u.aid, amount: 100, note: 'Welcome bonus', key: 'k1' } });
  assert.equal(r.status, 200);
  assert.ok(has(await items(w, u), 'Comrade Connect added KSh 100', 'Welcome bonus'));
});

test('gift: the creator sees the name the supporter typed and the message', async (t) => {
  const w = world(); t.after(() => w.restore());
  const c = await w.user('creator');
  await w.call('POST', '/api/me/gift', { as: c, body: { title: 'Molly', slug: 'molly' } });
  const r = await w.call('POST', '/api/gift/send', { body: { c: 'molly', item: 'coffee', phone: '0712345678', name: 'Kevin', message: 'Keep going' }, ip: '7.7.7.1' });
  await w.callback(w.row('payments', (x) => x.id === r.data.id), { receipt: 'SJK7ABC123' });
  const l = await items(w, c);
  assert.ok(has(l, 'Kevin sent you a gift', 'Coffee: KSh 270'));
  assert.ok(has(l, 'Kevin sent you a gift', 'Keep going'));
});

test('wholesale: joining tells the person until when', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('ws');
  w.db.rows('wallet_ledger').push({ id: crypto.randomUUID(), aid: u.aid, delta: 500, kind: 'topup', ref: 'seed', status: 'available' });
  const r = await w.call('POST', '/api/wholesale/join', { as: u, body: { method: 'wallet' } });
  assert.equal(r.status, 200);
  assert.ok(has(await items(w, u), 'Wholesaler membership active', 'until 20'));
});
