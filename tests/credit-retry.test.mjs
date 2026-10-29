import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

// The database misbehaves for the next `times` ledger writes of one kind, then works again.
// mode 'fail': answers with `status` and saves nothing. mode 'lost': saves the row but the answer is lost (503).
function misbehave(kind, times, { status = 503, mode = 'fail' } = {}) {
  const real = globalThis.fetch; let left = times;
  globalThis.fetch = async (url, o = {}) => {
    if (left > 0 && String(url).includes('/rest/v1/wallet_ledger') && o.method === 'POST' && String(o.body).includes('"kind":"' + kind + '"')) {
      left--; if (mode === 'lost') await real(url, o);
      return new Response('{"message":"db blip"}', { status, headers: { 'Content-Type': 'application/json' } });
    }
    return real(url, o);
  };
  return () => { globalThis.fetch = real; };
}
const verified = (w, u) => { w.row('profiles', (p) => p.aid === u.aid).verified = true; };
const fund = (w, u, n) => w.db.rows('wallet_ledger').push({ id: crypto.randomUUID(), aid: u.aid, delta: n, kind: 'topup', ref: 'seed' + n, status: 'available' });
const balance = async (w, u) => (await w.call('GET', '/api/wallet', { as: u })).data.balance;

test('escrow release: one database blip while paying the seller does not lose the money', async (t) => {
  const w = world(); t.after(() => w.restore());
  const seller = await w.user('seller'), buyer = await w.user('buyer');
  const { order } = await w.buy(buyer, await w.approvedListing(seller, 1000));
  order.status = 'handed'; order.auto_release_at = new Date(Date.now() - 1000).toISOString();
  const stop = misbehave('sale', 1); try { await w.cron(); } finally { stop(); }
  assert.equal(order.status, 'released'); assert.equal(await balance(w, seller), 970);
});

test('withdraw: the wallet debit is refused -> the request is cancelled and nothing is sent', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('wd'); verified(w, u); fund(w, u, 500);
  const stop = misbehave('withdrawal', 99, { status: 400 }); let r; try { r = await w.call('POST', '/api/wallet/withdraw', { as: u, body: { amount: 100, phone: '0700111222' } }); } finally { stop(); }
  assert.equal(r.status, 503);
  assert.equal(w.db.rows('withdrawals').filter((x) => x.aid === u.aid && x.status === 'requested').length, 0);
  assert.equal(await balance(w, u), 500);
});

test('withdraw: debit saved but the answer was lost -> taken exactly once, request goes ahead', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('wd2'); verified(w, u); fund(w, u, 500);
  const stop = misbehave('withdrawal', 1, { mode: 'lost' }); let r; try { r = await w.call('POST', '/api/wallet/withdraw', { as: u, body: { amount: 100, phone: '0700111222' } }); } finally { stop(); }
  assert.equal(r.status, 201); assert.equal(await balance(w, u), 400);
});
