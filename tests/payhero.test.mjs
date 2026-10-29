import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
import { SCHEMA } from './mockdb.js';

SCHEMA.payhero_events = { pk: ['id'], uniques: [(r) => r.event_key || null], defaults: {} };

function fakePayhero(t, { push = 'ok', pay = 'ok' } = {}) {
  const real = globalThis.fetch, seen = [], tx = {}; let n = 0;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (!u.includes('payhero.co.ke')) return real(url, init);
    const body = init.body ? JSON.parse(init.body) : {}, auth = (init.headers || {}).Authorization;
    seen.push({ u, method: init.method, auth, body });
    if (u.endsWith('/api/v2/payments')) {
      if (push === 'refuse') return new Response(JSON.stringify({ success: false }), { status: 400 });
      if (push === 'down') throw new Error('network');
      const ref = 'REF' + ++n; tx[ref] = { status: 'QUEUED', amount: body.amount, ext: body.external_reference };
      return new Response(JSON.stringify({ success: true, status: 'QUEUED', reference: ref, CheckoutRequestID: 'ws_CO_' + n }), { status: 201 });
    }
    if (u.endsWith('/api/v2/payouts')) {
      if (pay === 'refuse') return new Response(JSON.stringify({ success: false }), { status: 400 });
      if (pay === 'down') throw new Error('network');
      const ref = 'PAYREF' + ++n; tx[ref] = { status: 'QUEUED', amount: body.amount, ext: body.external_reference };
      return new Response(JSON.stringify({ success: true, status: 'QUEUED', reference: ref }), { status: 201 });
    }
    if (u.includes('/api/v2/transaction-status')) {
      const ref = new URL(u).searchParams.get('reference'), x = tx[ref];
      return x ? new Response(JSON.stringify({ reference: ref, status: x.status, amount: x.amount, provider_reference: x.receipt || null })) : new Response('{}', { status: 404 });
    }
    return new Response('{}', { status: 404 });
  };
  t.after(() => { globalThis.fetch = real; });
  return { seen, tx, set: (ref, v) => Object.assign(tx[ref], v) };
}
const ENV = { PAYMENT_MODE: 'payhero', PAYOUT_MODE: 'payhero', PAYHERO_API_KEY: 'key', PAYHERO_API_SECRET: 'secret', PAYHERO_CHANNEL_ID: '14575', PAYHERO_BASE_URL: 'https://backend.payhero.co.ke', PAYHERO_WEBHOOK_SECRET: 'whsec', CALLBACK_URL: 'https://api.test/api/webhooks/payhero', TINYPESA_API_KEY: '', TINYPESA_USERNAME: '' };
const fresh = async (t, env = {}, fake = {}) => { const w = world({ env: { ...ENV, ...env } }); t.after(() => w.restore()); return { w, ph: fakePayhero(t, fake) }; };
const deposit = async (w, as, amount = 100) => {
  const r = await w.call('POST', '/api/payhero/deposit', { as, body: { amount, phone: '0712345678' } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return w.row('payments', (p) => p.id === r.data.id);
};
const cb = (ext, o = {}) => ({ forward_url: '', status: o.code === 0 || o.code === undefined, response: { Amount: o.amount ?? 100, CheckoutRequestID: 'ws_CO_1', ExternalReference: ext, MpesaReceiptNumber: o.receipt ?? 'TKA1B2C3D4', Phone: '+254712345678', ResultCode: o.code ?? 0, ResultDesc: 'ok', Status: o.status ?? (o.code ? 'Failed' : 'Success') } });
const hook = (w, body, s = 'whsec') => w.call('POST', '/api/webhooks/payhero' + (s === null ? '' : '?s=' + s), { body });

test('deposit and callback flow works correctly', async (t) => {
  const { w } = await fresh(t);
  const a = await w.user('a'), p = await deposit(w, a, 100);
  assert.equal((await hook(w, cb('DEP_' + p.id, { amount: 100 }))).status, 200);
  assert.equal(w.row('payments', (x) => x.id === p.id).status, 'paid');
});
