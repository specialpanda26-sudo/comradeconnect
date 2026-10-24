import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

// A stand-in for IntaSend: records requests, keeps invoices, answers /status/ with whatever state the test sets.
function fakeIntaSend(t, { refuse = false } = {}) {
  const real = globalThis.fetch, inv = {}, seen = [];
  let n = 0;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (!u.includes('intasend.com')) return real(url, init);
    const body = init.body ? JSON.parse(init.body) : {};
    seen.push({ url: u, auth: (init.headers || {}).Authorization, body });
    if (u.endsWith('/api/v1/payment/mpesa-stk-push/')) {
      if (refuse) return new Response(JSON.stringify({ detail: 'nope' }), { status: 400 });
      const id = 'INV' + ++n;
      inv[id] = { invoice_id: id, state: 'PENDING', provider: 'M-PESA', value: String(body.amount), currency: 'KES', account: body.phone_number, api_ref: body.api_ref, mpesa_reference: null, failed_reason: null, failed_code: null };
      return new Response(JSON.stringify({ id: 'x', invoice: inv[id] }), { status: 201 });
    }
    if (u.endsWith('/api/v1/payment/status/')) return inv[body.invoice_id] ? new Response(JSON.stringify({ invoice: inv[body.invoice_id] })) : new Response('{}', { status: 404 });
    return new Response('{}', { status: 404 });
  };
  t.after(() => { globalThis.fetch = real; });
  return { inv, seen, set: (id, patch) => Object.assign(inv[id], patch) };
}
const ENV = { PAYMENT_MODE: 'intasend', INTASEND_SECRET_KEY: 'ISSecretKey_test_1', INTASEND_WEBHOOK_CHALLENGE: 'chal-123', TINYPESA_API_KEY: '', TINYPESA_USERNAME: '' };
const fresh = async (t, env = {}, fake = {}) => { const w = world({ env: { ...ENV, ...env } }); t.after(() => w.restore()); const is = fakeIntaSend(t, fake); return { w, is }; };
const startPay = async (w, as, amount = 50) => {
  const r = await w.call('POST', '/api/pay', { as, body: { purpose: 'topup', amount, phone: '0712345678' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return w.row('payments', (p) => p.id === r.data.id);
};
const hook = (w, body, challenge = 'chal-123') => w.call('POST', '/api/intasend/webhook', { body: { topic: 'collection_event', challenge, ...body } });

test('intasend: prompt is sent with our payment id as api_ref and the secret key as Bearer', async (t) => {
  const { w, is } = await fresh(t);
  const p = await startPay(w, await w.user('a'));
  assert.equal(p.request_id, 'is:INV1');
  assert.equal(is.seen[0].auth, 'Bearer ISSecretKey_test_1');
  assert.equal(is.seen[0].body.api_ref, p.id);
  assert.equal(is.seen[0].body.phone_number, '254712345678');
  assert.equal(is.seen[0].body.amount, 50);
});

test('intasend: no secret key refuses cleanly and writes no payment row', async (t) => {
  const { w } = await fresh(t, { INTASEND_SECRET_KEY: '' });
  const r = await w.call('POST', '/api/pay', { as: await w.user('a'), body: { purpose: 'topup', amount: 50, phone: '0712345678' } });
  assert.equal(r.status, 503);
  assert.equal(w.db.rows('payments').length, 0);
});

test('intasend: a webhook with the wrong challenge is rejected and nothing changes', async (t) => {
  const { w, is } = await fresh(t);
  const p = await startPay(w, await w.user('a'));
  is.set('INV1', { state: 'COMPLETE', mpesa_reference: 'SJT8H2K9QW' });
  assert.equal((await hook(w, { invoice_id: 'INV1', state: 'COMPLETE', api_ref: p.id }, 'guess')).status, 401);
  assert.equal(w.row('payments', (x) => x.id === p.id).status, 'pending');
});

test('intasend: no INTASEND_WEBHOOK_CHALLENGE set means the webhook is closed', async (t) => {
  const { w } = await fresh(t, { INTASEND_WEBHOOK_CHALLENGE: '' });
  const r = await hook(w, { invoice_id: 'INV1', state: 'COMPLETE' }, '');
  assert.equal(r.status, 503);
});

test('intasend: COMPLETE webhook, confirmed by IntaSend, marks the payment paid with the M-Pesa receipt', async (t) => {
  const { w, is } = await fresh(t);
  const p = await startPay(w, await w.user('a'));
  is.set('INV1', { state: 'COMPLETE', mpesa_reference: 'SJT8H2K9QW' });
  assert.equal((await hook(w, { invoice_id: 'INV1', state: 'COMPLETE', api_ref: p.id })).status, 200);
  const after = w.row('payments', (x) => x.id === p.id);
  assert.equal(after.status, 'paid');
  assert.equal(after.receipt, 'SJT8H2K9QW');
  assert.equal((await hook(w, { invoice_id: 'INV1', state: 'COMPLETE', api_ref: p.id })).status, 200);   // replay is harmless
  assert.equal(w.row('payments', (x) => x.id === p.id).status, 'paid');
});

test('intasend: a webhook that says COMPLETE while IntaSend says PENDING does not pay anything', async (t) => {
  const { w } = await fresh(t);
  const p = await startPay(w, await w.user('a'));
  await hook(w, { invoice_id: 'INV1', state: 'COMPLETE', api_ref: p.id });
  assert.equal(w.row('payments', (x) => x.id === p.id).status, 'pending');
});

test('intasend: an invoice that belongs to another payment cannot pay this one', async (t) => {
  const { w, is } = await fresh(t);
  const a = await w.user('a');
  const p1 = await startPay(w, a), p2 = await startPay(w, a);
  is.set('INV1', { state: 'COMPLETE', mpesa_reference: 'AAAAAAAAAA' });
  await hook(w, { invoice_id: 'INV1', state: 'COMPLETE', api_ref: p2.id });
  assert.equal(w.row('payments', (x) => x.id === p2.id).status, 'pending');
  assert.equal(w.row('payments', (x) => x.id === p1.id).status, 'pending');
});

test('intasend: paying less than asked is underpaid, not paid', async (t) => {
  const { w, is } = await fresh(t);
  const p = await startPay(w, await w.user('a'), 100);
  is.set('INV1', { state: 'COMPLETE', value: '40.00', mpesa_reference: 'SHORT12345' });
  await hook(w, { invoice_id: 'INV1', state: 'COMPLETE', api_ref: p.id });
  assert.equal(w.row('payments', (x) => x.id === p.id).status, 'underpaid');
});

test('intasend: a cancelled prompt marks the payment failed with the reason', async (t) => {
  const { w, is } = await fresh(t);
  const p = await startPay(w, await w.user('a'));
  is.set('INV1', { state: 'FAILED', failed_code: '1032', failed_reason: 'Request cancelled by user' });
  await hook(w, { invoice_id: 'INV1', state: 'FAILED', api_ref: p.id });
  const after = w.row('payments', (x) => x.id === p.id);
  assert.equal(after.status, 'failed');
  assert.equal(after.fail_reason, 'cancelled');
});

test('intasend: when IntaSend cannot be reached the webhook answers 502 so it can be replayed', async (t) => {
  const { w, is } = await fresh(t);
  const p = await startPay(w, await w.user('a'));
  delete is.inv.INV1;   // IntaSend does not answer for this invoice
  const r = await hook(w, { invoice_id: 'INV1', state: 'COMPLETE', api_ref: p.id });
  assert.equal(r.status, 502);
  assert.equal(w.row('payments', (x) => x.id === p.id).status, 'pending');
});

test('intasend: a missed webhook is recovered by the 15-minute cron', async (t) => {
  const { w, is } = await fresh(t);
  const p = await startPay(w, await w.user('a'));
  is.set('INV1', { state: 'COMPLETE', mpesa_reference: 'CRON123456' });
  const out = await w.cron();
  assert.equal(out.intasendChecked, 1);
  assert.equal(w.row('payments', (x) => x.id === p.id).status, 'paid');
});

test('intasend: a missed webhook is recovered when the buyer\'s app polls the status', async (t) => {
  const { w, is } = await fresh(t);
  const p = await startPay(w, await w.user('a'));
  is.set('INV1', { state: 'COMPLETE', mpesa_reference: 'POLL123456' });
  assert.equal((await w.call('GET', '/api/pay/status?id=' + p.id)).data.status, 'pending');   // under 30 s old: not asked yet
  w.row('payments', (x) => x.id === p.id).created_at = new Date(Date.now() - 60e3).toISOString();
  const r = await w.call('GET', '/api/pay/status?id=' + p.id);
  assert.equal(r.data.status, 'paid');
  assert.equal(r.data.receipt, 'POLL123456');
});

test('intasend: money that arrives after the payment expired goes to the admin approval queue', async (t) => {
  const { w, is } = await fresh(t);
  const p = await startPay(w, await w.user('a'));
  w.row('payments', (x) => x.id === p.id).created_at = new Date(Date.now() - 45 * 60e3).toISOString();
  await w.cron();
  assert.equal(w.row('payments', (x) => x.id === p.id).status, 'expired');
  is.set('INV1', { state: 'COMPLETE', mpesa_reference: 'LATE123456' });
  await hook(w, { invoice_id: 'INV1', state: 'COMPLETE', api_ref: p.id });
  const after = w.row('payments', (x) => x.id === p.id);
  assert.equal(after.status, 'submitted');
  assert.equal(after.receipt, 'LATE123456');
  assert.equal((await w.call('GET', '/api/admin/queue', { admin: true })).data.counts.confirm, 1);
  assert.equal((await w.call('POST', '/api/admin/payments/' + p.id, { admin: true, body: { action: 'approve' } })).status, 200);
  assert.equal(w.row('payments', (x) => x.id === p.id).status, 'paid');
});

test('intasend: if IntaSend refuses and TinyPesa keys exist, the prompt is sent through TinyPesa instead', async (t) => {
  const { w } = await fresh(t, { TINYPESA_API_KEY: 'tp', TINYPESA_USERNAME: 'link' }, { refuse: true });
  const p = await startPay(w, await w.user('a'));
  assert.ok(p.request_id && !p.request_id.startsWith('is:'));
  assert.ok(w.calls.some((c) => String(c.url).includes('tinypesa.com')));
});

test('intasend: if IntaSend refuses and there is no fallback, the buyer is told and the payment is closed', async (t) => {
  const { w } = await fresh(t, {}, { refuse: true });
  const r = await w.call('POST', '/api/pay', { as: await w.user('a'), body: { purpose: 'topup', amount: 50, phone: '0712345678' } });
  assert.equal(r.status, 502);
  assert.equal(w.db.rows('payments')[0].status, 'failed');
});

test('intasend mode is not manual mode: no code box, no manual info in the status', async (t) => {
  const { w } = await fresh(t);
  const p = await startPay(w, await w.user('a'));
  const st = await w.call('GET', '/api/pay/status?id=' + p.id);
  assert.equal(st.data.manual, undefined);
  assert.equal((await w.call('POST', '/api/pay/confirm', { as: await w.user('b'), body: { id: p.id, code: 'ABCDE12345' } })).status, 400);
});
