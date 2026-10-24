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

test('STK request matches the TinyPesa API: api host, username in the URL, ApiKey header, JSON body', async (t) => {
  const w = await fresh(t, { env: { TINYPESA_API_KEY: 'key123', TINYPESA_USERNAME: 'My Link' } });
  const a = await w.user('a');
  const r = await w.call('POST', '/api/pay', { as: a, body: { purpose: 'topup', amount: 50, phone: '0712345678' } });
  assert.equal(r.status, 200);
  const c = w.calls.find((x) => x.url.includes('tinypesa.com'));
  assert.equal(c.url, 'https://api.tinypesa.com/api/v1/express/initialize/?username=My%20Link');
  assert.equal(c.init.headers.ApiKey, 'key123');
  assert.equal(c.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(c.init.body), { amount: 50, msisdn: '254712345678' });
});

test('automatic mode without TINYPESA_USERNAME refuses cleanly', async (t) => {
  const w = await fresh(t, { env: { TINYPESA_USERNAME: '' } });
  const a = await w.user('a');
  const r = await w.call('POST', '/api/pay', { as: a, body: { purpose: 'topup', amount: 50, phone: '0712345678' } });
  assert.equal(r.status, 503);
});

test('a callback wrapped inside another object is still understood and completes the payment', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const r = await w.call('POST', '/api/pay', { as: a, body: { purpose: 'topup', amount: 50, phone: '0712345678' } });
  const p = w.row('payments', (x) => x.id === r.data.id);
  const wrapped = { data: { Body: { stkCallback: { CheckoutRequestID: p.request_id, ResultCode: 0, CallbackMetadata: { Item: [{ Name: 'Amount', Value: 50 }, { Name: 'MpesaReceiptNumber', Value: 'WRAP123456' }, { Name: 'PhoneNumber', Value: 254712345678 }] } } } } };
  const cb = await w.call('POST', '/api/tinypesa/callback?s=cb-secret', { body: wrapped });
  assert.equal(cb.status, 200);
  const after = w.row('payments', (x) => x.id === p.id);
  assert.equal(after.status, 'paid');
  assert.equal(after.receipt, 'WRAP123456');
});

const pay = async (w, a) => { const r = await w.call('POST', '/api/pay', { as: a, body: { purpose: 'topup', amount: 50, phone: '0712345678' } }); return w.row('payments', (x) => x.id === r.data.id); };

test('insufficient balance: payment fails with a reason the site and the admin panel can show', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const p = await pay(w, a);
  const cb = await w.callback(p, { code: 1 });
  assert.equal(cb.status, 200);
  const after = w.row('payments', (x) => x.id === p.id);
  assert.equal(after.status, 'failed');
  assert.equal(after.fail_reason, 'insufficient');
  const st = await w.call('GET', '/api/pay/status?id=' + p.id);
  assert.equal(st.data.status, 'failed');
  assert.equal(st.data.reason, 'insufficient');
  const q = await w.call('GET', '/api/admin/queue', { admin: true });
  const row = q.data.failed.find((x) => x.id === p.id);
  assert.equal(row.fail_reason, 'insufficient');
});

test('each M-Pesa result code maps to the right reason', async (t) => {
  for (const [code, reason] of [[1032, 'cancelled'], [1037, 'timeout'], [2001, 'wrong_pin'], [1001, 'busy'], [9999, 'other']]) {
    const w = await fresh(t);
    const a = await w.user('a');
    const p = await pay(w, a);
    await w.callback(p, { code });
    assert.equal(w.row('payments', (x) => x.id === p.id).fail_reason, reason, 'code ' + code);
    w.restore();
  }
});

test('a failure callback whose id does not match still fails the one waiting payment', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const p = await pay(w, a);
  const body = { Body: { stkCallback: { CheckoutRequestID: 'ws_CO_UNKNOWN', ResultCode: 1032, ResultDesc: 'Request cancelled by user' } } };
  await w.call('POST', '/api/tinypesa/callback?s=cb-secret', { body });
  const after = w.row('payments', (x) => x.id === p.id);
  assert.equal(after.status, 'failed');
  assert.equal(after.fail_reason, 'cancelled');
});

test('a failure callback with two payments waiting does not guess', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  const p1 = await pay(w, a);
  const r2 = await w.call('POST', '/api/pay', { as: b, body: { purpose: 'topup', amount: 70, phone: '0722000111' } });
  const body = { Body: { stkCallback: { CheckoutRequestID: 'ws_CO_UNKNOWN', ResultCode: 1, ResultDesc: 'insufficient' } } };
  await w.call('POST', '/api/tinypesa/callback?s=cb-secret', { body });
  assert.equal(w.row('payments', (x) => x.id === p1.id).status, 'pending');
  assert.equal(w.row('payments', (x) => x.id === r2.data.id).status, 'pending');
});

test('a prompt nobody answers expires with the reason no_response', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const p = await pay(w, a);
  p.created_at = new Date(Date.now() - 45 * 60e3).toISOString();
  await w.cron();
  const after = w.row('payments', (x) => x.id === p.id);
  assert.equal(after.status, 'expired');
  assert.equal(after.fail_reason, 'no_response');
});
