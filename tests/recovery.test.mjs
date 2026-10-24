import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const ENV = { BREVO_API_KEY: 'xkeysib-test', MAIL_FROM: 'Comrade Connect <no-reply@test.ke>', STUDENT_EMAIL_DOMAINS: 'ac.ke' };
const sent = (w) => w.calls.filter((x) => x.url.includes('api.brevo.com'));
const lastCode = (w) => JSON.parse(sent(w).pop().init.body).textContent.match(/code is (\d{6})/)[1];

test('anyone can add a recovery email (Gmail) and use it for forgot password; no plaintext stored', async () => {
  const w = world({ env: ENV }); const a = await w.user('a');
  let r = await w.call('POST', '/api/me/recovery-email/start', { as: a, body: { email: 'not-an-email' } });
  assert.equal(r.status, 400);
  r = await w.call('POST', '/api/me/recovery-email/start', { as: a, body: { email: 'Mary.Wanjiku+x@Gmail.com' } });
  assert.equal(r.status, 200); assert.equal(r.data.sent_to, 'ma***@gmail.com');
  r = await w.call('POST', '/api/me/recovery-email/confirm', { as: a, body: { code: '000000' === lastCode(w) ? '111111' : '000000' } });
  assert.equal(r.status, 400);
  r = await w.call('POST', '/api/me/recovery-email/confirm', { as: a, body: { code: lastCode(w) } });
  assert.equal(r.status, 200);
  assert.ok(!JSON.stringify(w.db.rows('profiles')).toLowerCase().includes('mary'));
  assert.equal((await w.call('GET', '/api/me/recovery-email', { as: a })).data.has_email, true);

  const before = sent(w).length;
  r = await w.call('POST', '/api/auth/reset/start', { body: { who: a.aid, email: 'someone.else@gmail.com' }, ip: '6.6.6.1' });
  assert.equal(r.status, 200); assert.equal(sent(w).length, before);
  r = await w.call('POST', '/api/auth/reset/start', { body: { who: a.aid, email: 'mary.wanjiku@GMAIL.com' }, ip: '6.6.6.2' });
  assert.equal(r.status, 200); assert.equal(sent(w).length, before + 1);
  r = await w.call('POST', '/api/auth/reset/confirm', { body: { who: a.aid, code: lastCode(w), password: 'Xk7m-Pq2R-vN9t-Lw4c' }, ip: '6.6.6.3' });
  assert.equal(r.status, 200); assert.equal(r.data.aid, a.aid);

  r = await w.call('POST', '/api/me/recovery-email/remove', { as: { aid: r.data.aid, token: r.data.token, ipn: a.ipn } });
  assert.equal(r.status, 200);
  const b2 = sent(w).length;
  await w.call('POST', '/api/auth/reset/start', { body: { who: a.aid, email: 'mary.wanjiku@gmail.com' }, ip: '6.6.6.4' });
  assert.equal(sent(w).length, b2);
  w.restore();
});
