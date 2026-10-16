// Escrow, wallet, referral and account tests. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
import { hasContact } from '../backend/src/lib.js';

const fresh = async (t, opts) => { const w = world(opts); t.after(() => w.restore()); return w; };

test('contact filter catches numbers, links, handles, spelled digits; allows normal text', () => {
  for (const bad of ['call 0712 345 678', '+254 712-345-678', 'text me 0 7 1 2 3 4 5 6 7 8', 'wa.me/254712345678', 'visit www.shop.com', 'find me @comrade_joe', 'zero seven one two three four five six seven eight',
    'whatsapp: me', 'shop.co.ke'])
    assert.equal(hasContact(bad), true, bad);
  for (const good of ['Casio calculator fx-991, KES 1500', 'Room near gate B, 2 people', 'Selling 3 chairs for 2000'])
    assert.equal(hasContact(good), false, good);
});

test('accounts: token required, recovery rotates the token, banned accounts are locked out', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  assert.equal((await w.call('GET', '/api/me')).status, 401);
  assert.equal((await w.call('GET', '/api/me', { as: { aid: a.aid, token: 'wrong' } })).status, 401);
  assert.equal((await w.call('GET', '/api/me', { as: a })).status, 200);
  assert.ok(!w.row('profiles', (p) => p.aid === a.aid).recovery_hash.includes(a.recovery), 'recovery code stored hashed');
  assert.ok(!JSON.stringify(w.db.rows('profiles')).includes(a.token), 'token never stored in clear');
  const bad = await w.call('POST', '/api/auth/recover', { body: { aid: a.aid, recovery_code: 'NOPE' } });
  assert.equal(bad.status, 401);
  const rec = await w.call('POST', '/api/auth/recover', { body: { aid: a.aid, recovery_code: a.recovery } });
  assert.equal(rec.status, 200);
  assert.equal((await w.call('GET', '/api/me', { as: a })).status, 401, 'old token is dead');
  const a2 = { ...a, token: rec.data.token };
  assert.equal((await w.call('GET', '/api/me', { as: a2 })).status, 200);
  assert.equal((await w.call('POST', '/api/auth/register', { body: { aid: a.aid } })).status, 409, 'cannot take an existing aid');
  await w.call('POST', `/api/admin/users/${a.aid}`, { admin: true, body: { action: 'ban' } });
  assert.equal((await w.call('GET', '/api/me', { as: a2 })).status, 403);
});

test('listing flow: pending until admin approves; contact info blocked; admin key required', async (t) => {
  const w = await fresh(t);
  const s = await w.user('s');
  const bad = await w.call('POST', '/api/market/listings', { as: s, body: { title: 'Phone', description: 'call 0712345678', price: 500 } });
  assert.equal(bad.status, 400);
  const l = await w.call('POST', '/api/market/listings', { as: s, body: { title: 'Casio', description: 'ok', price: 800 } });
  assert.equal(l.status, 201); assert.equal(l.data.status, 'pending');
  assert.equal((await w.call('GET', '/api/market/listings')).data.listings.length, 0, 'not public yet');
  assert.equal((await w.call('POST', `/api/admin/listings/${l.data.id}`, { body: { action: 'approve' } })).status, 403);
  assert.equal((await w.call('POST', `/api/admin/listings/${l.data.id}`, { admin: 'guess', body: { action: 'approve' } })).status, 403);
  assert.equal((await w.call('POST', `/api/admin/listings/${l.data.id}`, { admin: true, body: { action: 'approve' } })).status, 200);
  const pub = await w.call('GET', '/api/market/listings');
  assert.equal(pub.data.listings.length, 1);
  assert.ok(!JSON.stringify(pub.data).includes(s.aid), 'seller aid never exposed');
  assert.equal(w.row('listings', (x) => x.id === l.data.id).approved_by, 'admin');
  assert.equal((await w.call('POST', `/api/admin/listings/${l.data.id}`, { admin: true, body: { action: 'approve' } })).status, 409, 'cannot approve twice');
  const buyer = await w.user('b');
  assert.equal((await w.call('POST', '/api/market/buy', { as: s, body: { listing_id: l.data.id, phone: '0712345678' } })).status, 400, 'cannot buy own item');
});

test('escrow happy path: pay -> held -> handed -> code -> released -> seller wallet', async (t) => {
  const w = await fresh(t);
  const s = await w.user('s'), b = await w.user('b');
  const lid = await w.approvedListing(s, 1000);
  const { order, payment } = await w.buy(b, lid);
  assert.equal(payment.status, 'paid'); assert.equal(order.status, 'held');
  assert.equal(order.fee, 30); assert.equal(order.seller_amount, 970);
  assert.equal(w.row('listings', (l) => l.id === lid).status, 'sold');
  assert.ok(order.code_hash && !JSON.stringify(order).includes('"code"'), 'only a hash is stored');
  const mineB = (await w.call('GET', '/api/orders/mine', { as: b })).data.orders[0];
  const mineS = (await w.call('GET', '/api/orders/mine', { as: s })).data.orders[0];
  assert.match(mineB.code, /^\d{6}$/); assert.equal(mineS.code, undefined, 'seller never sees the code'); assert.equal(mineS.you_receive, 970);
  // confirm before handing over is refused
  assert.equal((await w.call('POST', `/api/orders/${order.id}/confirm`, { as: s, body: { code: mineB.code } })).status, 409);
  // buyer cannot mark handed
  assert.equal((await w.call('POST', `/api/orders/${order.id}/handed`, { as: b })).status, 403);
  assert.equal((await w.call('POST', `/api/orders/${order.id}/handed`, { as: s })).status, 200);
  assert.equal((await w.call('POST', `/api/orders/${order.id}/handed`, { as: s })).status, 409, 'not twice');
  const wrong = await w.call('POST', `/api/orders/${order.id}/confirm`, { as: s, body: { code: mineB.code === '000000' ? '111111' : '000000' } });
  assert.equal(wrong.status, 400);
  assert.equal((await w.call('POST', `/api/orders/${order.id}/confirm`, { as: b, body: { code: mineB.code } })).status, 403, 'buyer cannot release');
  assert.equal((await w.call('POST', `/api/orders/${order.id}/confirm`, { as: s, body: { code: mineB.code } })).status, 200);
  assert.equal(w.row('orders', (o) => o.id === order.id).status, 'released');
  assert.equal((await w.call('GET', '/api/me', { as: s })).data.balance, 970);
  assert.equal((await w.call('POST', `/api/orders/${order.id}/confirm`, { as: s, body: { code: mineB.code } })).status, 409, 'cannot release twice');
  assert.equal(w.db.rows('wallet_ledger').filter((x) => x.kind === 'sale').length, 1);
  // a stranger sees nothing
  const x = await w.user('x');
  assert.equal((await w.call('POST', `/api/orders/${order.id}/dispute`, { as: x, body: { reason: 'not mine at all' } })).status, 404);
});

test('replayed M-Pesa callback and wrong secret do not create extra orders or credits', async (t) => {
  const w = await fresh(t);
  const s = await w.user('s'), b = await w.user('b');
  const lid = await w.approvedListing(s, 500);
  const { payment, order } = await w.buy(b, lid);
  const again = await w.callback(w.row('payments', (p) => p.id === payment.id), { receipt: payment.receipt });
  assert.equal(again.status, 200);
  await w.callback(w.row('payments', (p) => p.id === payment.id), { receipt: 'OTHER' });
  assert.equal(w.db.rows('orders').length, 1);
  assert.equal((await w.callback(payment, { secret: 'wrong' })).status, 403);
  assert.equal(order.status, 'held');
});

test('underpayment does not create an order; failed STK marks payment failed', async (t) => {
  const w = await fresh(t);
  const s = await w.user('s'), b = await w.user('b');
  const lid = await w.approvedListing(s, 1000);
  const r = await w.call('POST', '/api/market/buy', { as: b, body: { listing_id: lid, phone: '0722111222' } });
  const p = w.row('payments', (x) => x.id === r.data.id);
  await w.callback(p, { amount: 10 });
  assert.equal(w.row('payments', (x) => x.id === p.id).status, 'underpaid');
  assert.equal(w.db.rows('orders').length, 0);
  assert.equal(w.row('listings', (l) => l.id === lid).status, 'approved');
  assert.equal((await w.call('GET', '/api/admin/queue', { admin: true })).data.counts.underpaid, 1, 'admin sees it to handle by hand');
  const r2 = await w.call('POST', '/api/market/buy', { as: b, body: { listing_id: lid, phone: '0722111333' } });
  await w.callback(w.row('payments', (x) => x.id === r2.data.id), { code: 1032 });
  assert.equal(w.row('payments', (x) => x.id === r2.data.id).status, 'failed');
});

test('two buyers pay for the same item: one gets it, the other is refunded to wallet', async (t) => {
  const w = await fresh(t);
  const s = await w.user('s'), b1 = await w.user('b1'), b2 = await w.user('b2');
  const lid = await w.approvedListing(s, 700);
  const r1 = await w.call('POST', '/api/market/buy', { as: b1, body: { listing_id: lid, phone: '0711000001' } });
  const r2 = await w.call('POST', '/api/market/buy', { as: b2, body: { listing_id: lid, phone: '0711000002' } });
  await Promise.all([w.callback(w.row('payments', (p) => p.id === r1.data.id)), w.callback(w.row('payments', (p) => p.id === r2.data.id))]);
  assert.equal(w.db.rows('orders').length, 1);
  const loser = w.db.rows('orders')[0].buyer_aid === b1.aid ? b2 : b1;
  assert.equal((await w.call('GET', '/api/me', { as: loser })).data.balance, 700);
});

test('wrong-code brute force is capped at 5 tries, even with parallel guesses', async (t) => {
  const w = await fresh(t);
  const s = await w.user('s'), b = await w.user('b');
  const { order } = await w.buy(b, await w.approvedListing(s, 900));
  await w.call('POST', `/api/orders/${order.id}/handed`, { as: s });
  const real = (await w.call('GET', '/api/orders/mine', { as: b })).data.orders[0].code;
  const guesses = Array.from({ length: 12 }, (_, i) => String(100000 + i)).filter((g) => g !== real);
  const rs = await Promise.all(guesses.map((g) => w.call('POST', `/api/orders/${order.id}/confirm`, { as: s, body: { code: g } })));
  assert.ok(w.row('orders', (o) => o.id === order.id).code_attempts <= 5);
  assert.ok(rs.filter((r) => r.status === 400).length <= 5);
  for (let i = 0; i < 6; i++) await w.call('POST', `/api/orders/${order.id}/confirm`, { as: s, body: { code: '999999' } });
  const late = await w.call('POST', `/api/orders/${order.id}/confirm`, { as: s, body: { code: real } });
  assert.equal(late.status, 429, 'locked even for the right code');
  assert.equal(w.row('orders', (o) => o.id === order.id).status, 'handed');
});

test('dispute: seller cannot release; admin refund returns money to buyer wallet and relists; no double refund', async (t) => {
  const w = await fresh(t);
  const s = await w.user('s'), b = await w.user('b');
  const lid = await w.approvedListing(s, 1200);
  const { order } = await w.buy(b, lid);
  await w.call('POST', `/api/orders/${order.id}/handed`, { as: s });
  assert.equal((await w.call('POST', `/api/orders/${order.id}/dispute`, { as: b, body: { reason: 'x' } })).status, 400, 'needs a real reason');
  assert.equal((await w.call('POST', `/api/orders/${order.id}/dispute`, { as: b, body: { reason: 'call me 0712345678 please' } })).status, 400, 'contact filter');
  assert.equal((await w.call('POST', `/api/orders/${order.id}/dispute`, { as: b, body: { reason: 'Item was broken' } })).status, 200);
  const real = (await w.call('GET', '/api/orders/mine', { as: b })).data.orders[0].code;
  assert.equal((await w.call('POST', `/api/orders/${order.id}/confirm`, { as: s, body: { code: real } })).status, 409, 'dispute freezes release');
  assert.equal((await w.call('GET', '/api/admin/queue', { admin: true })).data.disputes.length, 1);
  assert.equal((await w.call('POST', `/api/admin/orders/${order.id}`, { body: { action: 'refund' } })).status, 403);
  const [r1, r2] = await Promise.all([1, 2].map(() => w.call('POST', `/api/admin/orders/${order.id}`, { admin: true, body: { action: 'refund' } })));
  assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
  assert.equal((await w.call('GET', '/api/me', { as: b })).data.balance, 1200);
  assert.equal((await w.call('GET', '/api/me', { as: s })).data.balance, 0);
  assert.equal(w.row('listings', (l) => l.id === lid).status, 'approved');
  const o = w.row('orders', (x) => x.id === order.id);
  assert.equal(o.status, 'refunded'); assert.equal(o.dispute_status, 'resolved_refund'); assert.ok(o.refunded_at);
  assert.equal((await w.call('POST', `/api/admin/orders/${order.id}`, { admin: true, body: { action: 'release' } })).status, 409, 'finished orders stay finished');
});

test('dispute resolved in seller favour releases the money once', async (t) => {
  const w = await fresh(t);
  const s = await w.user('s'), b = await w.user('b');
  const { order } = await w.buy(b, await w.approvedListing(s, 2000));
  await w.call('POST', `/api/orders/${order.id}/dispute`, { as: s, body: { reason: 'Buyer refuses to give code' } });
  assert.equal((await w.call('POST', `/api/admin/orders/${order.id}`, { admin: true, body: { action: 'release' } })).status, 200);
  assert.equal((await w.call('GET', '/api/me', { as: s })).data.balance, 1940);
  const o = w.row('orders', (x) => x.id === order.id);
  assert.equal(o.status, 'released'); assert.equal(o.dispute_status, 'resolved_release'); assert.ok(o.released_at);
});

test('auto-release: handed order with no dispute is paid out after the window; disputed ones are not', async (t) => {
  const w = await fresh(t);
  const s = await w.user('s'), b = await w.user('b'), b2 = await w.user('b2');
  const o1 = (await w.buy(b, await w.approvedListing(s, 1000, 'Item one'))).order, o2 = (await w.buy(b2, await w.approvedListing(s, 500, 'Item two'))).order;
  for (const o of [o1, o2]) await w.call('POST', `/api/orders/${o.id}/handed`, { as: s });
  await w.call('POST', `/api/orders/${o2.id}/dispute`, { as: b2, body: { reason: 'Item not as described' } });
  await w.cron();
  assert.equal(w.row('orders', (o) => o.id === o1.id).status, 'handed', 'not yet due');
  for (const o of w.db.rows('orders')) o.auto_release_at = new Date(Date.now() - 1000).toISOString();
  const r = await w.cron();
  assert.equal(r.released, 1);
  assert.equal(w.row('orders', (o) => o.id === o1.id).status, 'released');
  assert.equal(w.row('orders', (o) => o.id === o2.id).status, 'disputed');
  await w.cron();
  assert.equal(w.db.rows('wallet_ledger').filter((x) => x.kind === 'sale').length, 1, 'no double payout on a second run');
});

test('withdrawals: need verified ID, cannot exceed balance, cannot overdraw in parallel, admin can pay or reject', async (t) => {
  const w = await fresh(t);
  const s = await w.user('s'), b = await w.user('b');
  const { order } = await w.buy(b, await w.approvedListing(s, 1000));
  await w.call('POST', `/api/orders/${order.id}/handed`, { as: s });
  const code = (await w.call('GET', '/api/orders/mine', { as: b })).data.orders[0].code;
  await w.call('POST', `/api/orders/${order.id}/confirm`, { as: s, body: { code } });             // seller has 970
  assert.equal((await w.call('POST', '/api/wallet/withdraw', { as: s, body: { amount: 100, phone: '0700111222' } })).status, 403, 'not verified');
  await w.call('POST', '/api/me/handle', { as: s, body: { handle: 'Seller_One' } });
  w.row('profiles', (p) => p.aid === s.aid).verified = true;
  assert.equal((await w.call('POST', '/api/wallet/withdraw', { as: s, body: { amount: 5000, phone: '0700111222' } })).status, 400);
  assert.equal((await w.call('POST', '/api/wallet/withdraw', { as: s, body: { amount: 10, phone: '0700111222' } })).status, 400, 'minimum 50');
  const par = await Promise.all([1, 2, 3].map(() => w.call('POST', '/api/wallet/withdraw', { as: s, body: { amount: 600, phone: '0700111222' } })));
  assert.equal(par.filter((r) => r.status === 201).length, 1, 'only one 600 fits in 970');
  assert.equal((await w.call('GET', '/api/me', { as: s })).data.balance, 370);
  const wd = w.db.rows('withdrawals').find((x) => x.status === 'requested');
  assert.equal((await w.call('POST', `/api/admin/withdrawals/${wd.id}`, { admin: true, body: { action: 'reject' } })).status, 200);
  assert.equal((await w.call('GET', '/api/me', { as: s })).data.balance, 970, 'rejected request returns the money');
  assert.equal((await w.call('POST', `/api/admin/withdrawals/${wd.id}`, { admin: true, body: { action: 'reject' } })).status, 409);
  w.db.t.ai_usage = [];                                   // new day: the 3-per-day withdrawal limit resets
  const w2 = await w.call('POST', '/api/wallet/withdraw', { as: s, body: { amount: 200, phone: '0700111222' } });
  assert.equal((await w.call('POST', `/api/admin/withdrawals/${w2.data.id}`, { admin: true, body: { action: 'paid' } })).status, 400, 'needs M-Pesa reference');
  assert.equal((await w.call('POST', `/api/admin/withdrawals/${w2.data.id}`, { admin: true, body: { action: 'paid', payout_ref: 'SJK12345' } })).status, 200);
  assert.equal((await w.call('GET', '/api/me', { as: s })).data.balance, 770);
});

test('referrals: one per person, no self-referral, reward unlocks only after the refund window and not if refunded', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b'), c = await w.user('c'), s = await w.user('s');
  assert.equal((await w.call('POST', '/api/referral/attribute', { as: a, body: { code: a.code } })).status, 404, 'self');
  assert.equal((await w.call('POST', '/api/referral/attribute', { as: b, body: { code: a.code } })).status, 201);
  assert.equal((await w.call('POST', '/api/referral/attribute', { as: b, body: { code: c.code } })).status, 409, 'only once');
  assert.equal((await w.call('POST', '/api/referral/attribute', { as: c, body: { code: a.code } })).status, 201);
  const o1 = (await w.buy(b, await w.approvedListing(s, 800, 'First'))).order;
  const o2 = (await w.buy(c, await w.approvedListing(s, 800, 'Second'))).order;
  let me = (await w.call('GET', '/api/referral/me', { as: a })).data;
  assert.equal(me.pending, 2); assert.equal(me.earned, 0);
  const r1 = w.row('referrals', (r) => r.referred_aid === b.aid);
  assert.ok(Date.parse(r1.unlock_at) - Date.now() > 6.9 * 864e5, 'about 7 days');
  assert.equal((await w.call('POST', '/api/referral/attribute', { as: b, body: { code: a.code } })).status, 400, 'too late after a purchase');
  await w.call('POST', `/api/admin/orders/${o2.id}`, { admin: true, body: { action: 'refund' } });          // c's order refunded in the window
  for (const r of w.db.rows('referrals')) r.unlock_at = new Date(Date.now() - 1000).toISOString();
  me = (await w.call('GET', '/api/referral/me', { as: a })).data;
  assert.equal(me.unlocked, 1); assert.equal(me.earned, 20);
  assert.equal((await w.call('GET', '/api/me', { as: a })).data.balance, 20);
  assert.equal(w.row('referrals', (r) => r.referred_aid === c.aid).status, 'void');
  await w.cron(); await w.call('GET', '/api/referral/me', { as: a });
  assert.equal((await w.call('GET', '/api/me', { as: a })).data.balance, 20, 'no double credit');
  const late = await w.call('POST', '/api/referral/attribute', { as: s, body: { code: a.code } });
  assert.equal(late.status, 201, 'seller has no purchases so may still be referred');
});

test('buyer can confirm receipt (held or handed), but not twice, not on dispute, and the seller cannot use it', async (t) => {
  const w = await fresh(t);
  const s = await w.user('s'), b = await w.user('b');
  const l1 = await w.approvedListing(s, 1000), l2 = await w.approvedListing(s, 500), l3 = await w.approvedListing(s, 400);
  const o1 = (await w.buy(b, l1)).order, o2 = (await w.buy(b, l2)).order, o3 = (await w.buy(b, l3)).order;
  // seller cannot use the buyer route
  assert.equal((await w.call('POST', `/api/orders/${o1.id}/received`, { as: s })).status, 403);
  // buyer confirms straight from "held" (seller never pressed handed)
  assert.equal((await w.call('POST', `/api/orders/${o1.id}/received`, { as: b })).status, 200);
  assert.equal(w.row('orders', (o) => o.id === o1.id).status, 'released');
  assert.equal((await w.call('POST', `/api/orders/${o1.id}/received`, { as: b })).status, 409, 'not twice');
  assert.equal((await w.call('GET', '/api/me', { as: s })).data.balance, 970);
  // buyer confirms after the seller marked handed
  await w.call('POST', `/api/orders/${o2.id}/handed`, { as: s });
  assert.equal((await w.call('POST', `/api/orders/${o2.id}/received`, { as: b })).status, 200);
  // an open dispute blocks it
  assert.equal((await w.call('POST', `/api/orders/${o3.id}/dispute`, { as: b, body: { reason: 'item was broken' } })).status, 200);
  assert.equal((await w.call('POST', `/api/orders/${o3.id}/received`, { as: b })).status, 409);
  assert.equal(w.db.rows('wallet_ledger').filter((x) => x.kind === 'sale').length, 2);
  // a stranger gets 404
  const x = await w.user('x');
  assert.equal((await w.call('POST', `/api/orders/${o3.id}/received`, { as: x })).status, 404);
});

test('google sign-in: verifies the token, creates, links a guest, signs back in, protects guests with activity', async (t) => {
  const w = await fresh(t, { env: { GOOGLE_CLIENT_ID: 'gid.test' } });
  const g = (cred, as, ip) => w.call('POST', '/api/auth/google', { body: { credential: cred }, as, ip: ip || '7.7.7.7' });
  assert.equal((await g('bad:x')).status, 401, 'invalid token refused');
  assert.equal((await g('wrongaud:x')).status, 401, 'token for another app refused');
  const c = await g('good:sub1');
  assert.equal(c.status, 201); assert.ok(c.data.aid.startsWith('u_'));
  const me = { aid: c.data.aid, token: c.data.token, ipn: 3 };
  assert.equal((await w.call('GET', '/api/me', { as: me })).status, 200);
  assert.equal(w.row('profiles', (p) => p.aid === me.aid).google_sub, 'sub1');
  // signing in again from a new phone gives the same account and kills the old token
  const again = await g('good:sub1');
  assert.equal(again.status, 200); assert.equal(again.data.aid, me.aid);
  assert.equal((await w.call('GET', '/api/me', { as: me })).status, 401, 'old token is dead');
  // a guest with no activity is linked, keeping its aid
  const guest = await w.user('guest');
  const l = await g('good:sub2', guest);
  assert.equal(l.status, 200); assert.equal(l.data.aid, guest.aid); assert.equal(l.data.linked, true);
  // a guest with a listing cannot be silently dropped when Google is already linked elsewhere
  const busy = await w.user('busy');
  await w.call('POST', '/api/market/listings', { as: busy, body: { title: 'Calculator Casio', description: 'Good condition', price: 1000, category: 'Electronics', zone: 'Town' } });
  const blocked = await g('good:sub1', busy);
  assert.equal(blocked.status, 409);
  // banned accounts cannot sign in
  await w.call('POST', `/api/admin/users/${c.data.aid}`, { admin: true, body: { action: 'ban' } });
  assert.equal((await g('good:sub1')).status, 403);
  // not configured = clear 503
  const w2 = await fresh(t);
  assert.equal((await w2.call('POST', '/api/auth/google', { body: { credential: 'good:x' } })).status, 503);
});
