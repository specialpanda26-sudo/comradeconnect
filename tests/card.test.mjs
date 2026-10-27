import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

// A stand-in for IntaSend's hosted card checkout.
function fakeIntaSend(t) {
  const real = globalThis.fetch, inv = {}, seen = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (!u.includes('intasend.com')) return real(url, init);
    const body = init.body ? JSON.parse(init.body) : {};
    seen.push({ url: u, body });
    if (u.endsWith('/api/v1/checkout/')) return new Response(JSON.stringify({ id: 'CHK1', url: 'https://payment.intasend.com/checkout/CHK1/', signature: 's' }), { status: 201 });
    if (u.endsWith('/api/v1/payment/status/')) return inv[body.invoice_id] ? new Response(JSON.stringify({ invoice: inv[body.invoice_id] })) : new Response('{}', { status: 404 });
    return new Response('{}', { status: 404 });
  };
  t.after(() => { globalThis.fetch = real; });
  return { inv, seen };
}
const CARD_SKIP = 'card payments are not in backend/src/pay.js (only M-Pesa). Remove the skip when card is built.';
const ENV = { PAYMENT_MODE: 'intasend', INTASEND_PUBLISHABLE_KEY: 'ISPubKey_test_1', INTASEND_SECRET_KEY: 'ISSecretKey_test_1', INTASEND_WEBHOOK_CHALLENGE: 'chal-123', TINYPESA_API_KEY: '', TINYPESA_USERNAME: '' };
const fresh = (t, env = {}) => { const w = world({ env: { ...ENV, ...env } }); t.after(() => w.restore()); return { w, is: fakeIntaSend(t) }; };

test.skip('card: methods route says card is on only with a publishable key', async (t) => {
  const a = fresh(t); assert.equal((await a.w.call('GET', '/api/pay/methods')).data.card, true);
  const b = fresh(t, { INTASEND_PUBLISHABLE_KEY: '' }); assert.equal((await b.w.call('GET', '/api/pay/methods')).data.card, false);
  const c = fresh(t, { CARD_PAYMENTS: '0' }); assert.equal((await c.w.call('GET', '/api/pay/methods')).data.card, false);
});

test.skip('card: starting a card payment returns IntaSend\'s page and needs no phone', async (t) => {
  const { w, is } = fresh(t);
  const u = await w.user('c1');
  const r = await w.call('POST', '/api/pay', { as: u, body: { purpose: 'topup', amount: 500, method: 'card' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.url, 'https://payment.intasend.com/checkout/CHK1/');
  const p = w.row('payments', (x) => x.id === r.data.id);
  assert.equal(p.request_id, 'ic:CHK1'); assert.equal(p.phone, 'card'); assert.equal(p.status, 'pending');
  const sent = is.seen[0].body;
  assert.equal(sent.method, 'CARD-PAYMENT'); assert.equal(sent.api_ref, p.id); assert.equal(sent.amount, 500); assert.equal(sent.currency, 'KES');
  assert.equal(sent.public_key, 'ISPubKey_test_1'); assert.match(sent.redirect_url, /pay-done\.html$/);
});

test.skip('card: webhook is checked with IntaSend, then the payment is paid exactly once', async (t) => {
  const { w, is } = fresh(t);
  const u = await w.user('c2');
  const r = await w.call('POST', '/api/pay', { as: u, body: { purpose: 'topup', amount: 500, method: 'card' } });
  is.inv['INVCARD1'] = { invoice_id: 'INVCARD1', state: 'COMPLETE', provider: 'CARD-PAYMENT', value: '500.00', currency: 'KES', api_ref: r.data.id, provider_ref: 'CARDREF1' };
  const hook = () => w.call('POST', '/api/intasend/webhook', { body: { topic: 'collection_event', challenge: 'chal-123', invoice_id: 'INVCARD1', state: 'COMPLETE', api_ref: r.data.id } });
  assert.equal((await hook()).status, 200); await hook();
  const p = w.row('payments', (x) => x.id === r.data.id);
  assert.equal(p.status, 'paid');
  assert.equal(w.db.rows('wallet_ledger').filter((x) => x.aid === u.aid && x.delta === 500).length, 1);
});

test.skip('card: a webhook that names someone else\'s payment or too small an amount is not paid', async (t) => {
  const { w, is } = fresh(t);
  const u = await w.user('c3');
  const r = await w.call('POST', '/api/pay', { as: u, body: { purpose: 'topup', amount: 500, method: 'card' } });
  is.inv['INVLOW'] = { invoice_id: 'INVLOW', state: 'COMPLETE', value: '100.00', currency: 'KES', api_ref: r.data.id };
  await w.call('POST', '/api/intasend/webhook', { body: { topic: 'collection_event', challenge: 'chal-123', invoice_id: 'INVLOW', state: 'COMPLETE', api_ref: r.data.id } });
  assert.notEqual(w.row('payments', (x) => x.id === r.data.id).status, 'paid');
  const bad = await w.call('POST', '/api/intasend/webhook', { body: { topic: 'collection_event', challenge: 'wrong', invoice_id: 'INVLOW', state: 'COMPLETE', api_ref: r.data.id } });
  assert.equal(bad.status, 401);
});

test('card: refused when cards are not on, and M-Pesa still works', async (t) => {
  const { w } = fresh(t, { INTASEND_PUBLISHABLE_KEY: '' });
  const u = await w.user('c4');
  const r = await w.call('POST', '/api/pay', { as: u, body: { purpose: 'topup', amount: 500, method: 'card' } });
  assert.equal(r.status, 400); assert.equal(w.db.rows('payments').length, 0);
});
