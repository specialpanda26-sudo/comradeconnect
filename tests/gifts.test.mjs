import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const MAIL = { BREVO_API_KEY: 'xkeysib-test', MAIL_FROM: 'Comrade Connect <no-reply@test.ke>' };
const balance = async (w, u) => (await w.call('GET', '/api/wallet', { as: u })).data.balance;

test('gift link: create, public page, supporter pays, site keeps its percentage, creator wallet gets the rest', async () => {
  const w = world({ env: { ...MAIL, GIFT_FEE_PERCENT: '10' } }); const c = await w.user('creator');
  let r = await w.call('POST', '/api/me/gift', { as: c, body: { title: 'Molly of Chicago', slug: 'molly' } });
  assert.equal(r.status, 200); assert.equal(r.data.link.path, 'gift.html?c=molly');
  r = await w.call('POST', '/api/me/gift', { as: await w.user('x'), body: { title: 'Other', slug: 'MOLLY' } });
  assert.equal(r.status, 409);
  r = await w.call('POST', '/api/me/gift', { as: await w.user('y'), body: { title: 'Other', slug: 'admin' } });
  assert.equal(r.status, 400);

  r = await w.call('GET', '/api/gift/public?c=Molly');
  assert.equal(r.status, 200); assert.equal(r.data.title, 'Molly of Chicago');
  assert.deepEqual(r.data.presets.map((p) => p.amount), [50, 100, 300, 500, 1000]);
  assert.ok(!JSON.stringify(r.data).includes(c.aid));
  assert.equal((await w.call('GET', '/api/gift/public?c=nobody')).status, 404);

  r = await w.call('POST', '/api/gift/send', { body: { c: 'molly', item: 'coffee', phone: '0712345678', name: 'Kevin', message: 'Keep going', email: 'k@gmail.com' }, ip: '7.7.7.1' });
  assert.equal(r.status, 200); assert.equal(r.data.amount, 300);
  const pay = w.row('payments', (x) => x.id === r.data.id);
  assert.equal(pay.purpose, 'gift'); assert.equal(pay.amount, 300);
  assert.equal(await balance(w, c), 0);

  await w.callback(pay, { receipt: 'SJK7ABC123' });
  await w.callback(pay, { receipt: 'SJK7ABC123' });
  assert.equal(await balance(w, c), 270);
  const g = w.db.rows('gifts')[0];
  assert.equal(g.status, 'paid'); assert.equal(g.fee, 30); assert.equal(g.net, 270); assert.equal(g.receipt_email, null);
  assert.ok(w.calls.some((x) => x.url.includes('api.brevo.com')));

  r = await w.call('GET', '/api/me/gift', { as: c });
  assert.equal(r.data.earned.net, 270); assert.equal(r.data.earned.count, 1); assert.equal(r.data.recent[0].name, 'Kevin');
  assert.ok(!JSON.stringify(r.data).includes('0712345678'));
  r = await w.call('GET', '/api/admin/earnings', { admin: true });
  assert.equal(r.data.gifts.total, 30); assert.ok(r.data.total_earned >= 30);
  w.restore();
});

test('gift link: custom amounts follow the limits, blocked contact details, paused links, failed payments pay nothing', async () => {
  const w = world({ env: {} }); const c = await w.user('c');
  await w.call('POST', '/api/me/gift', { as: c, body: { title: 'Joy', slug: 'joy_art' } });
  const send = (b) => w.call('POST', '/api/gift/send', { body: { c: 'joy_art', phone: '0712345678', ...b }, ip: '8.8.8.' + Math.floor(Math.random() * 200) });
  assert.equal((await send({ item: 'custom', amount: 5 })).status, 400);
  assert.equal((await send({ item: 'custom', amount: 999999 })).status, 400);
  assert.equal((await send({ item: 'cake', message: 'call me 0722123456' })).status, 400);
  assert.equal((await w.call('POST', '/api/gift/send', { body: { c: 'joy_art', item: 'cake', phone: '12' }, ip: '8.8.8.250' })).status, 400);

  let r = await send({ item: 'custom', amount: 77 }); assert.equal(r.status, 200); assert.equal(r.data.amount, 77);
  const pay = w.row('payments', (x) => x.id === r.data.id);
  await w.callback(pay, { code: 1032 });
  assert.equal(w.db.rows('gifts')[0].status, 'failed');
  assert.equal((await w.call('GET', '/api/wallet', { as: c })).data.balance, 0);

  await w.call('POST', '/api/me/gift', { as: c, body: { active: false } });
  assert.equal((await send({ item: 'cake' })).status, 404);
  assert.equal((await w.call('GET', '/api/me/gift', { as: c })).data.link.active, false);
  w.restore();
});
