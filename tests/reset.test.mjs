import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const BREVO = { BREVO_API_KEY: 'xkeysib-test', MAIL_FROM: 'Comrade Connect <no-reply@test.ke>', STUDENT_EMAIL_DOMAINS: 'ac.ke' };
const sent = (w) => w.calls.filter((x) => x.url.includes('api.brevo.com'));
const lastCode = (w) => JSON.parse(sent(w).pop().init.body).textContent.match(/code is (\d{6})/)[1];
const NEWPW = 'Xk7m-Pq2R-vN9t-Lw4c';

test('forgot password: only the email is asked, code arrives, new password works, old one stops, other phones signed out', async () => {
  const w = world({ env: BREVO }); const a = await w.user('a');
  await w.call('POST', '/api/me/credentials', { as: a, body: { handle: 'jane_k', password: 'river-lamp-stone-moon' } });
  let r = await w.call('POST', '/api/verify/email/start', { as: a, body: { email: 'jane@kyu.ac.ke' } });
  r = await w.call('POST', '/api/verify/email/confirm', { as: a, body: { code: lastCode(w) } });
  assert.equal(r.status, 200);
  const before = sent(w).length;

  r = await w.call('POST', '/api/auth/reset/start', { body: {}, ip: '5.5.5.0' });
  assert.equal(r.status, 400);                                                     // no email, no reset
  r = await w.call('POST', '/api/auth/reset/start', { body: { email: 'other@kyu.ac.ke' }, ip: '5.5.5.1' });
  assert.equal(r.status, 200); assert.equal(sent(w).length, before);               // unknown email: same polite answer, nothing sent

  r = await w.call('POST', '/api/auth/reset/start', { body: { email: 'Jane@Students.kyu.ac.ke' }, ip: '5.5.5.3' });
  assert.equal(r.status, 200); assert.equal(sent(w).length, before + 1);
  assert.ok(!JSON.stringify(w.db.rows('password_resets')).includes('jane@'));
  const code = lastCode(w);

  r = await w.call('POST', '/api/auth/reset/confirm', { body: { email: 'jane@kyu.ac.ke', code: code === '000000' ? '111111' : '000000', password: NEWPW }, ip: '5.5.5.4' });
  assert.equal(r.status, 400); assert.match(r.data.error, /Wrong code/); assert.ok(!/tries left/.test(r.data.error));
  r = await w.call('POST', '/api/auth/reset/confirm', { body: { email: 'jane@kyu.ac.ke', code, password: 'short' }, ip: '5.5.5.5' });
  assert.equal(r.status, 400);                                                     // weak password refused, code kept
  r = await w.call('POST', '/api/auth/reset/confirm', { body: { email: 'someone@else.com', code, password: NEWPW }, ip: '5.5.5.5' });
  assert.equal(r.status, 400);                                                     // right code, wrong email: refused
  r = await w.call('POST', '/api/auth/reset/confirm', { body: { email: 'jane@kyu.ac.ke', code, password: NEWPW }, ip: '5.5.5.6' });
  assert.equal(r.status, 200); assert.equal(r.data.aid, a.aid); assert.ok(r.data.token);
  r = await w.call('POST', '/api/auth/reset/confirm', { body: { email: 'jane@kyu.ac.ke', code, password: NEWPW }, ip: '5.5.5.9' });
  assert.equal(r.status, 410);                                                     // the same code cannot be replayed

  r = await w.call('POST', '/api/auth/recover', { body: { aid: 'jane_k', password: 'river-lamp-stone-moon' }, ip: '5.5.5.7' });
  assert.equal(r.status, 401);                                                     // old password dead
  r = await w.call('POST', '/api/auth/recover', { body: { aid: 'jane_k', password: NEWPW }, ip: '5.5.5.8' });
  assert.equal(r.status, 200);
  r = await w.call('GET', '/api/me', { as: a });
  assert.equal(r.status, 401);                                                     // the old phone's token no longer works
  w.restore();
});

test('forgot password: off without mail settings', async () => {
  const w = world({ env: {} });
  const r = await w.call('POST', '/api/auth/reset/start', { body: { email: 'a@kyu.ac.ke' } });
  assert.equal(r.status, 503);
  w.restore();
});

test('one email can be saved on only one account, so a reset never hits the wrong person', async () => {
  const w = world({ env: BREVO }); const a = await w.user('a'), b = await w.user('b');
  let r = await w.call('POST', '/api/me/recovery-email/start', { as: a, body: { email: 'shared@gmail.com' } });
  r = await w.call('POST', '/api/me/recovery-email/confirm', { as: a, body: { code: lastCode(w) } });
  assert.equal(r.status, 200);
  r = await w.call('POST', '/api/me/recovery-email/start', { as: b, body: { email: 'shared@gmail.com' } });
  r = await w.call('POST', '/api/me/recovery-email/confirm', { as: b, body: { code: lastCode(w) } });
  assert.equal(r.status, 400); assert.match(r.data.error, /Could not save that email/); assert.ok(!/already|another account|registered/i.test(r.data.error));
  w.restore();
});
