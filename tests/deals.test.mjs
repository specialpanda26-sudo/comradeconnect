import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
const fresh = async (t) => { const w = world(); t.after(() => w.restore()); return w; };
const soon = (n = 10) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
const deal = (o = {}) => ({ business: 'Mama Pima Eatery', title: '20% off every meal with your student ID', category: 'Food', place: 'Next to the main gate', billing_phone: '0712345678', valid_until: soon(), ...o });
async function live(w, owner, o) {
  const d = (await w.call('POST', '/api/deals', { as: owner, body: deal(o), campus: 'kirinyaga' })).data;
  assert.equal((await w.call('POST', `/api/admin/deals/${d.id}`, { admin: true, body: { action: 'approve' } })).status, 200);
  return d.id;
}

test('deals: posting needs sign-in, rules are enforced, and a deal stays hidden until approved', async (t) => {
  const w = await fresh(t), owner = await w.user('o'), c = await w.user('c');
  assert.equal((await w.call('POST', '/api/deals', { body: deal() })).status, 401);
  assert.equal((await w.call('POST', '/api/deals', { as: owner, body: deal({ title: 'Call 0712345678 for a deal' }) })).status, 400, 'phone numbers are refused in public text');
  assert.equal((await w.call('POST', '/api/deals', { as: owner, body: deal({ billing_phone: '123' }) })).status, 400);
  assert.equal((await w.call('POST', '/api/deals', { as: owner, body: deal({ valid_until: '2020-01-01' }) })).status, 400);
  assert.equal((await w.call('POST', '/api/deals', { as: owner, body: deal({ valid_until: soon(400) }) })).status, 400, 'too far ahead');
  const r = await w.call('POST', '/api/deals', { as: owner, body: deal(), campus: 'kirinyaga' });
  assert.equal(r.status, 201);
  assert.equal((await w.call('GET', '/api/deals', { campus: 'kirinyaga' })).data.items.length, 0, 'pending is hidden');
  assert.equal((await w.call('POST', `/api/deals/${r.data.id}/claim`, { as: c })).status, 400, 'cannot claim before approval');
  await w.call('POST', `/api/admin/deals/${r.data.id}`, { admin: true, body: { action: 'approve' } });
  const list = (await w.call('GET', '/api/deals', { campus: 'kirinyaga' })).data;
  assert.equal(list.items.length, 1);
  assert.equal(JSON.stringify(list).includes('0712345678') || JSON.stringify(list).includes('254712345678'), false, 'billing phone is never public');
  assert.equal((await w.call('GET', '/api/deals', { campus: 'uon' })).data.items.length, 0, 'other campus does not see it');
});

test('deals: claim, show code, owner confirms once, fee is recorded for billing', async (t) => {
  const w = await fresh(t), owner = await w.user('o'), c = await w.user('c'), other = await w.user('x');
  const id = await live(w, owner);
  assert.equal((await w.call('POST', `/api/deals/${id}/claim`, { as: owner })).status, 400, 'owner cannot claim own deal');
  const cl = await w.call('POST', `/api/deals/${id}/claim`, { as: c });
  assert.equal(cl.status, 201); assert.match(cl.data.code, /^\d{6}$/);
  const again = await w.call('POST', `/api/deals/${id}/claim`, { as: c });
  assert.equal(again.status, 200); assert.equal(again.data.code, cl.data.code, 'same code is shown again');
  assert.equal(w.db.rows('deal_claims').length, 1);
  assert.equal(w.db.rows('deal_claims')[0].code_hash.includes(cl.data.code), false, 'the code itself is never stored');
  const mine = (await w.call('GET', '/api/deals/mine', { as: c })).data;
  assert.equal(mine.claims[0].code, cl.data.code); assert.equal(mine.claims[0].status, 'claimed');
  assert.equal((await w.call('POST', `/api/deals/${id}/redeem`, { as: other, body: { code: cl.data.code } })).status, 403, 'only the owner confirms');
  assert.equal((await w.call('POST', `/api/deals/${id}/redeem`, { as: owner, body: { code: '12' } })).status, 400);
  const wrong = cl.data.code === '000000' ? '000001' : '000000';
  assert.equal((await w.call('POST', `/api/deals/${id}/redeem`, { as: owner, body: { code: wrong } })).status, 404);
  const ok = await w.call('POST', `/api/deals/${id}/redeem`, { as: owner, body: { code: cl.data.code } });
  assert.equal(ok.status, 200); assert.equal(ok.data.fee, 5);
  assert.equal((await w.call('POST', `/api/deals/${id}/redeem`, { as: owner, body: { code: cl.data.code } })).status, 404, 'a code works once');
  assert.equal((await w.call('POST', `/api/deals/${id}/claim`, { as: c })).status, 400, 'already used');
  assert.equal((await w.call('GET', '/api/deals/mine', { as: c })).data.claims[0].status, 'redeemed');
  const mineOwner = (await w.call('GET', '/api/deals/mine', { as: owner })).data;
  assert.equal(mineOwner.deals[0].redeemed, 1);
  const bill = (await w.call('GET', '/api/admin/deals/billing', { admin: true })).data;
  assert.equal(bill.total, 5); assert.equal(bill.redemptions, 1); assert.equal(bill.businesses[0].business, 'Mama Pima Eatery');
  assert.equal((await w.call('GET', '/api/admin/deals/billing')).status, 403);
});

test('deals: places run out, expired codes cannot be confirmed, owner can end a deal', async (t) => {
  const w = await fresh(t), owner = await w.user('o'), a = await w.user('a'), b = await w.user('b'), d3 = await w.user('d');
  const id = await live(w, owner, { max_claims: 1 });
  const first = await w.call('POST', `/api/deals/${id}/claim`, { as: a });
  assert.equal(first.status, 201);
  const full = await w.call('POST', `/api/deals/${id}/claim`, { as: b });
  assert.equal(full.status, 400); assert.match(full.data.error, /taken/);
  assert.equal((await w.call('GET', '/api/deals', { campus: 'kirinyaga' })).data.items[0].left, 0);
  w.db.rows('deal_claims')[0].expires_at = new Date(Date.now() - 1000).toISOString();     // the 24 hours pass
  assert.equal((await w.call('POST', `/api/deals/${id}/redeem`, { as: owner, body: { code: first.data.code } })).status, 404, 'expired code');
  assert.equal((await w.call('POST', `/api/deals/${id}/claim`, { as: b })).status, 201, 'an expired claim frees its place');
  assert.equal((await w.call('POST', `/api/deals/${id}/end`, { as: d3 })).status, 403);
  assert.equal((await w.call('POST', `/api/deals/${id}/end`, { as: owner })).status, 200);
  assert.equal((await w.call('GET', '/api/deals', { campus: 'kirinyaga' })).data.items.length, 0, 'ended deals disappear');
});

test('deals: admin rejects with a note, owner sees it, reports hide after three, fee is an editable setting', async (t) => {
  const w = await fresh(t), owner = await w.user('o');
  const d = (await w.call('POST', '/api/deals', { as: owner, body: deal(), campus: 'kirinyaga' })).data;
  assert.equal((await w.call('POST', `/api/admin/deals/${d.id}`, { body: { action: 'approve' } })).status, 403);
  assert.equal((await w.call('POST', `/api/admin/deals/${d.id}`, { admin: true, body: { action: 'reject', note: 'Add the real discount' } })).status, 200);
  const mine = (await w.call('GET', '/api/deals/mine', { as: owner })).data.deals[0];
  assert.equal(mine.status, 'rejected'); assert.equal(mine.note, 'Add the real discount');
  assert.equal((await w.call('GET', '/api/admin/deals?status=rejected', { admin: true })).data.deals.length, 1);
  const id = await live(w, owner);
  for (const n of ['r1', 'r2', 'r3']) { const r = await w.user(n); assert.equal((await w.call('POST', '/api/report', { as: r, body: { type: 'deal', id, reason: 'Scam or fake' } })).status, 200); }
  assert.equal((await w.call('GET', '/api/deals', { campus: 'kirinyaga' })).data.items.length, 0, 'three reports hide it');
  const s = await w.call('POST', '/api/admin/settings', { admin: true, body: { values: { deal_fee_per_redeem: 10 } } });
  assert.equal(s.status, 200, JSON.stringify(s.data));
  const id2 = await live(w, owner, { title: 'Free soda with any burger and student ID' });
  const c = await w.user('c2'); const cl = await w.call('POST', `/api/deals/${id2}/claim`, { as: c });
  assert.equal((await w.call('POST', `/api/deals/${id2}/redeem`, { as: owner, body: { code: cl.data.code } })).data.fee, 10, 'the new fee applies to new redemptions');
});
