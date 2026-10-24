// Automatic payouts: sent once, only when switched on, failures return the money, unclear cases never double-pay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

function fakeSend(t, { mode = 'ok' } = {}) {
  const real = globalThis.fetch, seen = []; let n = 0; const state = {};
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (!u.includes('intasend.com')) return real(url, init);
    const body = init.body ? JSON.parse(init.body) : {}; seen.push({ u, body });
    if (u.endsWith('/send-money/initiate/')) {
      if (mode === 'refuse') return new Response(JSON.stringify({ detail: 'no funds' }), { status: 400 });
      if (mode === 'down') throw new Error('network');
      const id = 'TRK' + ++n; state[id] = 'Processing'; return new Response(JSON.stringify({ tracking_id: id, status: 'Processing' }), { status: 201 });
    }
    if (u.endsWith('/send-money/status/')) {
      const st = state[body.tracking_id];
      return new Response(JSON.stringify({ tracking_id: body.tracking_id, status: st === 'Processing' ? 'Processing' : 'Completed', transactions: [{ status: st, provider_reference: 'RX' + body.tracking_id, account: '254700111222', amount: '100.00' }] }));
    }
    return new Response('{}', { status: 404 });
  };
  t.after(() => { globalThis.fetch = real; });
  return { seen, set: (id, v) => { state[id] = v; } };
}
const ENV = { PAYOUT_MODE: 'intasend', INTASEND_SECRET_KEY: 'ISSecretKey_test_1' };
const setup = async (t, env = ENV, fake = {}) => {
  const w = world({ env }); t.after(() => w.restore()); const is = fakeSend(t, fake);
  const s = await w.user('s'), b = await w.user('b');
  const { order } = await w.buy(b, await w.approvedListing(s, 1000));
  await w.call('POST', `/api/orders/${order.id}/received`, { as: b });          // seller has 970
  await w.call('POST', '/api/me/handle', { as: s, body: { handle: 'Seller_One' } });
  w.row('profiles', (p) => p.aid === s.aid).verified = true;
  return { w, is, s };
};
const wd = (w, s, amount) => w.call('POST', '/api/wallet/withdraw', { as: s, body: { amount, phone: '0700111222' } });
const bal = async (w, s) => (await w.call('GET', '/api/me', { as: s })).data.balance;

test('payout: auto sends the net amount, then marks paid with the M-Pesa reference', async (t) => {
  const { w, is, s } = await setup(t);
  const r = await wd(w, s, 100);
  assert.equal(r.status, 201); assert.equal(r.data.status, 'sending');
  const sent = is.seen.find((x) => x.u.endsWith('/initiate/')).body;
  assert.equal(sent.provider, 'MPESA-B2C'); assert.equal(sent.transactions[0].account, '254700111222'); assert.equal(sent.transactions[0].amount, 100);
  assert.equal((await w.call('GET', '/api/wallet', { as: s })).data.withdrawals[0].status, 'sending', 'still processing');
  is.set('TRK1', 'Successful');
  const got = (await w.call('GET', '/api/wallet', { as: s })).data.withdrawals[0];
  assert.equal(got.status, 'paid'); assert.equal(got.payout_ref, 'RXTRK1');
  assert.equal(await bal(w, s), 870);
});

test('payout: a failed send returns the money once', async (t) => {
  const { w, is, s } = await setup(t);
  await wd(w, s, 100); is.set('TRK1', 'Failed');
  await w.call('GET', '/api/wallet', { as: s }); await w.call('GET', '/api/wallet', { as: s }); await w.cron();
  assert.equal(w.db.rows('withdrawals')[0].status, 'rejected'); assert.equal(await bal(w, s), 970);
});

test('payout: refused by IntaSend falls back to the admin queue (money stays reserved)', async (t) => {
  const { w, s } = await setup(t, ENV, { mode: 'refuse' });
  const before = await bal(w, s), r = await wd(w, s, 100);
  assert.equal(r.status, 502, 'a clear refusal tells the user and returns the money'); assert.equal(await bal(w, s), before, 'money is back in the wallet');
});

test('payout: no answer from IntaSend stays "sending" and is never sent a second time', async (t) => {
  const { w, is, s } = await setup(t, ENV, { mode: 'down' });
  assert.equal((await wd(w, s, 100)).data.status, 'sending');
  await w.cron(); assert.equal(w.db.rows('withdrawals')[0].status, 'sending', 'young: still waiting');
  w.db.rows('withdrawals')[0].created_at = new Date(Date.now() - 30 * 60e3).toISOString();
  await w.cron(); assert.equal(w.db.rows('withdrawals')[0].status, 'requested', 'after 15 min a human decides');
  assert.equal(is.seen.filter((x) => x.u.endsWith('/initiate/')).length, 1);
});

test('payout: small (under KSh 10 net) and over-the-daily-limit requests stay manual; switched off means manual', async (t) => {
  const { w, is, s } = await setup(t);
  const small = await wd(w, s, 5);
  assert.equal(small.status, 400); assert.match(small.data.error, /smallest amount/i);
  assert.equal(is.seen.length, 0, 'nothing sent to IntaSend');
  const off = await setup(t, {});
  assert.equal((await wd(off.w, off.s, 100)).data.status, 'requested');
  const big = await setup(t, { ...ENV, PAYOUT_AUTO_DAILY_MAX: '150' });
  assert.equal((await wd(big.w, big.s, 100)).data.status, 'sending');
  const over = await wd(big.w, big.s, 100);
  assert.equal(over.status, 400); assert.match(over.data.error, /daily/i, '200 would pass the 150 daily limit');
});

test('payout: a sending request cannot be cancelled or paid by hand at the same time', async (t) => {
  const { w, s } = await setup(t);
  await wd(w, s, 100); const id = w.db.rows('withdrawals')[0].id;
  assert.equal((await w.call('POST', `/api/wallet/withdraw/${id}/cancel`, { as: s, body: {} })).status, 409);
  assert.equal((await w.call('POST', `/api/admin/withdrawals/${id}`, { admin: true, body: { action: 'paid', payout_ref: 'ABC1234567' } })).status, 409);
});
