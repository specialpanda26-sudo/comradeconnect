import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

// Runs one wallet join while the database refuses a certain write; returns the join answer and the state afterwards.
async function joinWhileRefusing(t, refuse) {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('ws');
  w.db.rows('wallet_ledger').push({ id: crypto.randomUUID(), aid: u.aid, delta: 500, kind: 'topup', ref: 'seed', status: 'available' });
  const real = globalThis.fetch; let r;
  globalThis.fetch = async (url, o = {}) => refuse(String(url), o)
    ? new Response(JSON.stringify({ code: '23514' }), { status: 400, headers: { 'Content-Type': 'application/json' } }) : real(url, o);
  try { r = await w.call('POST', '/api/wholesale/join', { as: u, body: { method: 'wallet' } }); } finally { globalThis.fetch = real; }
  return { r, active: (await w.call('GET', '/api/wholesale/me', { as: u })).data.active, balance: (await w.call('GET', '/api/wallet', { as: u })).data.balance };
}

test('wholesale by wallet: debit cannot be saved -> no membership, no charge', async (t) => {
  const x = await joinWhileRefusing(t, (url, o) => url.includes('/rest/v1/wallet_ledger') && o.method === 'POST' && String(o.body).includes('wholesale_fee'));
  assert.equal(x.r.status, 503); assert.equal(x.active, false); assert.equal(x.balance, 500);
});

test('wholesale by wallet: membership cannot be saved -> the charge is undone', async (t) => {
  const x = await joinWhileRefusing(t, (url, o) => url.includes('/rest/v1/profiles') && o.method === 'PATCH' && String(o.body).includes('wholesaler_until'));
  assert.equal(x.r.status, 500); assert.equal(x.active, false); assert.equal(x.balance, 500);
});
