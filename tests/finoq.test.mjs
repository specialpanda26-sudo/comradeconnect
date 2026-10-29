// FinoQ (PayHero) deposits and payouts: request shape, webhook safety, expiry cleanup, rate limit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
import { finoqChannel, finoqReady, parseFinoqWebhook } from '../backend/src/finoq.js';

const ENV = { PAYHERO_API_KEY: 'k', PAYHERO_API_SECRET: 's', PAYHERO_CHANNEL_ID: '777', PAYHERO_CALLBACK_SECRET: 'sec', CALLBACK_URL: 'https://api.test/api/webhooks/payhero?s=sec', PAYHERO_PAYOUTS_ENABLED: '1' };

function fakePayHero(t, { mode = 'ok' } = {}) {
  const real = globalThis.fetch, seen = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (!u.includes('payhero.co.ke')) return real(url, init);
    const body = init.body ? JSON.parse(init.body) : {}; seen.push({ u, body, auth: init.headers && init.headers.Authorization });
    if (mode === 'refuse') return new Response(JSON.stringify({ error: 'bad' }), { status: 400 });
    if (u.endsWith('/api/v2/withdraw')) return new Response(JSON.stringify({ status: 'QUEUED', merchant_reference: 'W5ZBQ', checkout_request_id: 'CR1' }), { status: 200 });
    return new Response(JSON.stringify({ success: true, status: 'QUEUED', reference: 'PH1' }), { status: 200 });
  };
  t.after(() => { globalThis.fetch = real; });
  return seen;
}
const hook = (w, ref, { status = 'SUCCESS', amount, phone, secret = 'sec', receipt = 'RCPT1', code } = {}) =>
  w.call('POST', '/api/webhooks/payhero?s=' + secret, { body: { response: { ExternalReference: ref, Status: status, ...(amount !== undefined ? { Amount: amount } : {}), ...(phone ? { Phone: phone } : {}), MpesaReceiptNumber: receipt, ...(code ? { ResultCode: code } : {}) } } });
const setup = async (t, opts) => { const w = world({ env: ENV }); t.after(() => w.restore()); const seen = fakePayHero(t, opts); const u = await w.user('a'); return { w, seen, u }; };
const topup = (w, u, amount = 100, phone = '0712345678') => w.call('POST', '/api/pay', { as: u, body: { purpose: 'topup', amount, phone } });

test('finoq config: no hardcoded channel, needs key + secret + channel', () => {
  assert.equal(finoqChannel({}), 0);
  assert.equal(finoqReady({ PAYHERO_API_KEY: 'a', PAYHERO_API_SECRET: 'b' }), false);
  assert.equal(finoqReady({ PAYHERO_API_KEY: 'a', PAYHERO_API_SECRET: 'b', PAYHERO_CHANNEL_ID: '5' }), true);
});

test('finoq webhook parser reads PayHero nested success and failure', () => {
  const ok = parseFinoqWebhook({ response: { ExternalReference: 'CC-DEP-1', Status: 'Success', Amount: 100, MpesaReceiptNumber: 'abc', Phone: '+254712345678' } });
  assert.equal(ok.success, true); assert.equal(ok.amount, 100); assert.equal(ok.receipt, 'ABC'); assert.equal(ok.phone, '254712345678');
  const bad = parseFinoqWebhook({ response: { ExternalReference: 'CC-DEP-1', Status: 'Failed', ResultCode: 1032 } });
  assert.equal(bad.failed, true); assert.equal(bad.code, 1032);
});

test('deposit: STK request matches PayHero docs and the webhook credits the wallet once', async (t) => {
  const { w, seen, u } = await setup(t);
  const r = await topup(w, u); assert.equal(r.status, 200);
  const stk = seen.find((x) => x.u.endsWith('/api/v2/payments'));
  assert.equal(stk.body.channel_id, 777); assert.equal(stk.body.provider, 'm-pesa'); assert.match(stk.body.external_reference, /^CC-DEP-/); assert.equal(stk.body.callback_url, ENV.CALLBACK_URL);
  assert.match(stk.auth, /^Basic /);
  const p = w.row('payments', (x) => x.id === r.data.id);
  assert.equal((await hook(w, p.request_id, { amount: 100 })).data.result, 'paid');
  assert.equal((await hook(w, p.request_id, { amount: 100 })).data.result, 'duplicate', 'a repeated callback cannot credit twice');
  assert.equal(w.db.rows('wallet_ledger').filter((x) => x.aid === u.aid && x.kind === 'topup').length, 1);
});

test('webhook: wrong secret is refused; success with no amount is NOT credited; underpaid is not credited', async (t) => {
  const { w, u } = await setup(t);
  const r = await topup(w, u); const row = w.row('payments', (x) => x.id === r.data.id);
  assert.equal((await hook(w, row.request_id, { amount: 100, secret: 'nope' })).status, 403);
  assert.equal((await hook(w, row.request_id)).data.result, 'no_amount');
  assert.equal(w.row('payments', (x) => x.id === row.id).status, 'pending');
  assert.equal((await hook(w, row.request_id, { amount: 50 })).data.result, 'underpaid');
  assert.equal(w.db.rows('wallet_ledger').filter((x) => x.kind === 'topup').length, 0);
});

test('webhook: a different payer phone is not credited', async (t) => {
  const { w, u } = await setup(t);
  const r = await topup(w, u); const row = w.row('payments', (x) => x.id === r.data.id);
  assert.equal((await hook(w, row.request_id, { amount: 100, phone: '254799000111' })).data.result, 'phone_mismatch');
  assert.equal((await hook(w, row.request_id, { amount: 100, phone: '254712345678' })).data.result, 'paid');
});

test('webhook: failure marks failed with a reason', async (t) => {
  const { w, u } = await setup(t);
  const r = await topup(w, u); const row = w.row('payments', (x) => x.id === r.data.id);
  assert.equal((await hook(w, row.request_id, { status: 'Failed', code: 1032 })).data.result, 'failed');
  const after = w.row('payments', (x) => x.id === row.id); assert.equal(after.status, 'failed'); assert.equal(after.fail_reason, 'cancelled');
});

test('cron: unanswered deposits expire AND run the failed cleanup (points returned)', async (t) => {
  const { w, u } = await setup(t);
  const r = await topup(w, u); const row = w.row('payments', (x) => x.id === r.data.id);
  row.created_at = new Date(Date.now() - 20 * 60e3).toISOString();
  let failedFor = null; const { hooks } = await import('../backend/src/pay.js'); const prev = hooks.onFailed; hooks.onFailed = async (env, p) => { failedFor = p.id; return prev(env, p); };
  t.after(() => { hooks.onFailed = prev; });
  const out = await w.cron();
  assert.equal(failedFor, row.id, 'onFailed ran for the expired payment');
  assert.equal(w.row('payments', (x) => x.id === row.id).status, 'expired'); assert.ok(out.depositsExpired >= 1);
  assert.equal((await hook(w, row.request_id, { amount: 100 })).data.result, 'paid', 'a late success still credits');
});

test('paid but onPaid throws: payment is reopened, answer is 500, and a retry delivers', async (t) => {
  const { w, u } = await setup(t);
  const r = await topup(w, u); const row = w.row('payments', (x) => x.id === r.data.id);
  const { hooks } = await import('../backend/src/pay.js'); const prev = hooks.onPaid; let boom = true;
  hooks.onPaid = async (env, p) => { if (boom) throw new Error('db down'); return prev(env, p); };
  t.after(() => { hooks.onPaid = prev; });
  assert.equal((await hook(w, row.request_id, { amount: 100 })).status, 500);
  assert.equal(w.row('payments', (x) => x.id === row.id).status, 'expired', 'not stuck as paid');
  boom = false;
  assert.equal((await hook(w, row.request_id, { amount: 100 })).data.result, 'paid');
  assert.equal(w.db.rows('wallet_ledger').filter((x) => x.kind === 'topup').length, 1);
});

test('rate limit: STK prompts per phone are capped per day', async (t) => {
  const w = world({ env: { ...ENV, STK_DAILY_PER_PHONE: '2' } }); t.after(() => w.restore()); fakePayHero(t); const u = await w.user('a');
  assert.equal((await topup(w, u)).status, 200); assert.equal((await topup(w, u)).status, 200);
  assert.equal((await topup(w, u)).status, 429);
});

test('payout: uses /api/v2/withdraw with b2c body and callback_url; refused payout returns the money', async (t) => {
  const { finoqPayout } = await import('../backend/src/finoq.js');
  const seen = fakePayHero(t);
  const r = await finoqPayout(ENV, { amount: 100, phone: '254712345678', ref: 'CC-WDL-1' });
  assert.equal(r.ok, true); assert.equal(r.tx, 'W5ZBQ');
  const b = seen[0].body; assert.ok(seen[0].u.endsWith('/api/v2/withdraw'));
  assert.deepEqual([b.channel, b.payment_service, b.network_code, b.channel_id, b.callback_url], ['mobile', 'b2c', '63902', 777, ENV.CALLBACK_URL]);
});
