import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const fresh = async (t, opts) => { const w = world(opts); t.after(() => w.restore()); return w; };

test('automatic mode without TINYPESA_API_KEY refuses cleanly and writes no payment row', async (t) => {
  const w = await fresh(t, { env: { TINYPESA_API_KEY: '' } });
  const a = await w.user('a');
  const r = await w.call('POST', '/api/pay', { as: a, body: { purpose: 'topup', amount: 50, phone: '0712345678' } });
  assert.equal(r.status, 503);
  assert.equal(w.db.rows('payments').length, 0);
});

test('a callback that arrives after the payment expired goes to the admin confirm queue, not lost', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const r = await w.call('POST', '/api/pay', { as: a, body: { purpose: 'topup', amount: 50, phone: '0712345678' } });
  assert.equal(r.status, 200);
  const p = w.row('payments', (x) => x.id === r.data.id);
  p.created_at = new Date(Date.now() - 45 * 60e3).toISOString();
  await w.cron();
  assert.equal(w.row('payments', (x) => x.id === p.id).status, 'expired');
  const cb = await w.callback(w.row('payments', (x) => x.id === p.id), { receipt: 'LATE123456' });
  assert.equal(cb.status, 200);
  const after = w.row('payments', (x) => x.id === p.id);
  assert.equal(after.status, 'submitted');
  assert.equal(after.receipt, 'LATE123456');
  assert.equal((await w.call('GET', '/api/admin/queue', { admin: true })).data.counts.confirm, 1);
});

test('a late callback with too little money is not parked for approval', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const r = await w.call('POST', '/api/pay', { as: a, body: { purpose: 'topup', amount: 50, phone: '0712345678' } });
  const p = w.row('payments', (x) => x.id === r.data.id);
  p.created_at = new Date(Date.now() - 45 * 60e3).toISOString();
  await w.cron();
  await w.callback(w.row('payments', (x) => x.id === p.id), { receipt: 'SHORT12345', amount: 10 });
  assert.equal(w.row('payments', (x) => x.id === p.id).status, 'expired');
});
