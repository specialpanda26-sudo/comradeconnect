import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
import { normStudentEmail } from '../backend/src/trust.js';

const MAIL = { RESEND_API_KEY: 're_test', MAIL_FROM: 'Comrade Connect <no-reply@test.ke>' };
const lastCode = (w) => { const c = w.calls.filter((x) => x.url.includes('api.resend.com')).pop(); return JSON.parse(c.init.body).text.match(/code is (\d{6})/)[1]; };
const mails = (w) => w.calls.filter((x) => x.url.includes('api.resend.com'));

test('trust info: public, matches live settings, shows a worked fee example', async () => {
  const w = world({ env: { PAYMENT_MODE: 'manual', MPESA_PAY_TYPE: 'till', MPESA_PAY_NAME: 'Comrade Shop', WITHDRAW_FEE_PERCENT: '1', WITHDRAW_FEE_FLAT: '5' } });
  const r = await w.call('GET', '/api/trust?amount=2000');
  assert.equal(r.status, 200);
  const d = r.data;
  assert.equal(d.payments.mode, 'manual');
  assert.equal(d.payments.pay_type, 'till');
  assert.equal(d.payments.pay_to_name, 'Comrade Shop');
  assert.equal(d.payments.gateway.automatic, false);
  assert.equal(d.fees.platform_fee_percent, 3);
  assert.equal(d.fees.buyer_fee_percent, 0);
  assert.deepEqual(d.fees.example, { sale: 2000, fee: 60, seller_receives: 1940, withdrawal_fee: 20 + 5, seller_net_to_mpesa: 1915 });
  assert.equal(d.escrow.auto_release_days, 3);
  assert.equal(d.disputes.review_hours, 48);
  assert.equal(d.operator.reg_no, null);                 // never invents a registration number
  assert.deepEqual(d.identity.student_domains, ['kyu.ac.ke']);
  assert.equal(d.identity.student_email_available, false);
  // secrets never appear
  assert.ok(!JSON.stringify(d).includes('admin-secret-key') && !JSON.stringify(d).includes('test-pepper'));
  w.restore();
});

test('trust info: gateway follows PAYMENT_MODE and fee changes made by an admin', async () => {
  const w = world({ env: { PAYMENT_MODE: 'intasend', INTASEND_SECRET_KEY: 'ISSecretKey_x', OPERATOR_REG_NO: 'BN-123', DISPUTE_REVIEW_HOURS: '24' } });
  let d = (await w.call('GET', '/api/trust')).data;
  assert.equal(d.payments.gateway.name, 'IntaSend');
  assert.equal(d.payments.gateway.fallback, 'TinyPesa');   // tinypesa keys exist in the test world
  assert.equal(d.operator.reg_no, 'BN-123');
  assert.equal(d.disputes.review_hours, 24);
  await w.call('POST', '/api/admin/settings', { admin: true, body: { values: { platform_fee_percent: 5 } } });
  d = (await w.call('GET', '/api/trust')).data;
  assert.equal(d.fees.platform_fee_percent, 5);
  w.restore();
});

test('student email: only approved domains, subdomains ok, look-alikes refused, +tags collapse', () => {
  const env = {};
  assert.equal(normStudentEmail(env, 'jane@kyu.ac.ke').canon, 'jane@kyu.ac.ke');
  assert.equal(normStudentEmail(env, 'Jane+spam@Students.KYU.ac.ke').canon, 'jane@kyu.ac.ke');
  for (const bad of ['jane@gmail.com', 'jane@kyu.ac.ke.evil.com', 'jane@notkyu.ac.ke', 'jane@evil-kyu.ac.ke', '@kyu.ac.ke', '+x@kyu.ac.ke', 'jane@kyu.ac.ke ,x@gmail.com', '', null])
    assert.equal(normStudentEmail(env, bad), null, String(bad));
  assert.equal(normStudentEmail({ STUDENT_EMAIL_DOMAINS: 'kyu.ac.ke, uonbi.ac.ke' }, 'a@students.uonbi.ac.ke').canon, 'a@uonbi.ac.ke');
});

test('student email: full flow, anonymous (no plaintext email stored), one mailbox per account', async () => {
  const w = world({ env: MAIL });
  const a = await w.user('a'), b = await w.user('b');
  let r = await w.call('POST', '/api/verify/email/start', { as: a, body: { email: 'jane@gmail.com' } });
  assert.equal(r.status, 400); assert.match(r.data.error, /@kyu\.ac\.ke/);
  assert.equal(mails(w).length, 0);
  r = await w.call('POST', '/api/verify/email/start', { as: a, body: { email: 'Jane.Doe@students.kyu.ac.ke' } });
  assert.equal(r.status, 200); assert.equal(r.data.sent_to, 'ja***@students.kyu.ac.ke');
  assert.equal(mails(w).length, 1);
  assert.ok(!JSON.stringify(w.db.rows('email_verifications')).includes('jane'));   // only hashes
  r = await w.call('POST', '/api/verify/email/start', { as: a, body: { email: 'jane.doe@kyu.ac.ke' } });
  assert.equal(r.status, 429);                                                     // 60 s cooldown
  r = await w.call('POST', '/api/verify/email/confirm', { as: a, body: { code: '000000' === lastCode(w) ? '111111' : '000000' } });
  assert.equal(r.status, 400); assert.match(r.data.error, /4 tries left/);
  r = await w.call('POST', '/api/verify/email/confirm', { as: a, body: { code: lastCode(w) } });
  assert.equal(r.status, 200);
  const prof = w.row('profiles', (p) => p.aid === a.aid);
  assert.equal(prof.student_verified, true);
  assert.ok(prof.student_email_hash && !prof.student_email_hash.includes('jane'));
  assert.equal(w.db.rows('email_verifications').length, 0);
  assert.equal((await w.call('GET', '/api/me', { as: a })).data.student_verified, true);
  assert.equal((await w.call('GET', '/api/verify/email/status', { as: a })).data.student_verified, true);
  // the same mailbox (even with a +tag) cannot unlock a second account
  w.db.rows('email_verifications').length = 0;
  await w.call('POST', '/api/verify/email/start', { as: b, body: { email: 'jane.doe+x@kyu.ac.ke' } });
  r = await w.call('POST', '/api/verify/email/confirm', { as: b, body: { code: lastCode(w) } });
  assert.equal(r.status, 409);
  assert.equal(w.row('profiles', (p) => p.aid === b.aid).student_verified, false);
  // unlink frees it and removes the badge
  r = await w.call('POST', '/api/verify/email/unlink', { as: a });
  assert.equal(r.status, 200);
  assert.equal(w.row('profiles', (p) => p.aid === a.aid).student_email_hash, null);
  w.restore();
});

test('student email: 5 wrong codes lock it, expiry works, off when mail is not configured, never on the feed', async () => {
  const off = world();
  const o = await off.user('o');
  assert.equal((await off.call('POST', '/api/verify/email/start', { as: o, body: { email: 'a@kyu.ac.ke' } })).status, 503);
  off.restore();

  const w = world({ env: MAIL });
  const a = await w.user('a');
  await w.call('POST', '/api/verify/email/start', { as: a, body: { email: 'a@kyu.ac.ke' } });
  const good = lastCode(w), bad = good === '123456' ? '654321' : '123456';
  let last;
  for (let i = 0; i < 5; i++) last = await w.call('POST', '/api/verify/email/confirm', { as: a, body: { code: bad } });
  assert.equal(last.status, 400);
  last = await w.call('POST', '/api/verify/email/confirm', { as: a, body: { code: good } });
  assert.equal(last.status, 429);                                                   // even the right code is refused after 5 misses
  assert.equal(w.row('profiles', (p) => p.aid === a.aid).student_verified, false);
  w.db.rows('email_verifications')[0].attempts = 0;
  w.db.rows('email_verifications')[0].expires_at = new Date(Date.now() - 1000).toISOString();
  last = await w.call('POST', '/api/verify/email/confirm', { as: a, body: { code: good } });
  assert.equal(last.status, 410);
  // anonymity: public feed answers carry no student flag
  const feed = await w.call('GET', '/api/posts');
  assert.ok(!JSON.stringify(feed.data).includes('student'));
  w.restore();
});

test('market: seller shows a student badge, fee and dispute deadline are exposed to the right person only', async () => {
  const w = world({ env: { DISPUTE_REVIEW_HOURS: '36' } });
  const seller = await w.user('s'), buyer = await w.user('b');
  w.row('profiles', (p) => p.aid === seller.aid).student_verified = true;
  const lid = await w.approvedListing(seller, 1000);
  const l = await w.call('GET', `/api/market/listings/${lid}`);
  assert.equal(l.data.seller.student, true);
  const { order } = await w.buy(buyer, lid);
  await w.call('POST', `/api/orders/${order.id}/dispute`, { as: buyer, body: { reason: 'Item not as described' } });
  const s = (await w.call('GET', '/api/orders/mine', { as: seller })).data.orders[0];
  const by = (await w.call('GET', '/api/orders/mine', { as: buyer })).data.orders[0];
  assert.equal(s.fee, 30); assert.equal(s.you_receive, 970);
  assert.equal(by.fee, undefined);
  const due = Date.parse(by.dispute_due_at) - Date.parse(w.row('orders', (o) => o.id === order.id).disputed_at);
  assert.equal(due, 36 * 3600e3);
  w.restore();
});

test('trust info: payout terms are stated and configurable', async () => {
  const w = world({ env: { PAYOUT_TARGET_HOURS: '12' } });
  const d = (await w.call('GET', '/api/trust')).data;
  assert.equal(d.payouts.target_hours, 12);
  assert.equal(d.payouts.cancel_until_paid, true);
  assert.equal((await world().call('GET', '/api/trust')).data.payouts.target_hours, 24);
  w.restore();
});
