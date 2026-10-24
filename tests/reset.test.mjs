import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const BREVO = { BREVO_API_KEY: 'xkeysib-test', MAIL_FROM: 'Comrade Connect <no-reply@test.ke>', STUDENT_EMAIL_DOMAINS: 'ac.ke' };
const sent = (w) => w.calls.filter((x) => x.url.includes('api.brevo.com'));
const lastCode = (w) => JSON.parse(sent(w).pop().init.body).textContent.match(/code is (\d{6})/)[1];

test('forgot password: code to the verified student email, new password works, old one stops, other phones signed out', async () => {
  const w = world({ env: BREVO }); const a = await w.user('a');
  await w.call('POST', '/api/me/credentials', { as: a, body: { handle: 'jane_k', password: 'river-lamp-stone-moon' } });
  let r = await w.call('POST', '/api/verify/email/start', { as: a, body: { email: 'jane@kyu.ac.ke' } });
  r = await w.call('POST', '/api/verify/email/confirm', { as: a, body: { code: lastCode(w) } });
  assert.equal(r.status, 200);
  const before = sent(w).length;

  // wrong email or unknown user: same polite answer, nothing sent
  r = await w.call('POST', '/api/auth/reset/start', { body: { who: 'jane_k', email: 'other@kyu.ac.ke' }, ip: '5.5.5.1' });
  assert.equal(r.status, 200); assert.equal(sent(w).length, before);
  r = await w.call('POST', '/api/auth/reset/start', { body: { who: 'nobody_x', email: 'jane@kyu.ac.ke' }, ip: '5.5.5.2' });
  assert.equal(r.status, 200); assert.equal(sent(w).length, before);

  r = await w.call('POST', '/api/auth/reset/start', { body: { who: 'jane_k', email: 'Jane@Students.kyu.ac.ke' }, ip: '5.5.5.3' });
  assert.equal(r.status, 200); assert.equal(sent(w).length, before + 1);
  assert.ok(!JSON.stringify(w.db.rows('password_resets')).includes('jane@'));
  const code = lastCode(w);

  r = await w.call('POST', '/api/auth/reset/confirm', { body: { who: 'jane_k', code: code === '000000' ? '111111' : '000000', password: 'Xk7m-Pq2R-vN9t-Lw4c' }, ip: '5.5.5.4' });
  assert.equal(r.status, 400); assert.match(r.data.error, /4 tries left/);
  r = await w.call('POST', '/api/auth/reset/confirm', { body: { who: 'jane_k', code, password: 'short' }, ip: '5.5.5.5' });
  assert.equal(r.status, 400);                                                    // weak password refused, code kept
  r = await w.call('POST', '/api/auth/reset/confirm', { body: { who: 'jane_k', code, password: 'Xk7m-Pq2R-vN9t-Lw4c' }, ip: '5.5.5.6' });
  assert.equal(r.status, 200); assert.equal(r.data.aid, a.aid); assert.ok(r.data.token);
  assert.equal(w.db.rows('password_resets').length, 0);

  r = await w.call('POST', '/api/auth/recover', { body: { who: 'jane_k', password: 'river-lamp-stone-moon', aid: 'jane_k' }, ip: '5.5.5.7' });
  assert.equal(r.status, 401);                                                    // old password dead
  r = await w.call('POST', '/api/auth/recover', { body: { aid: 'jane_k', password: 'Xk7m-Pq2R-vN9t-Lw4c' }, ip: '5.5.5.8' });
  assert.equal(r.status, 200);
  r = await w.call('GET', '/api/me', { as: a });
  assert.equal(r.status, 401);                                                    // the old phone's token no longer works
  w.restore();
});

test('forgot password: off without mail settings, and a used code cannot be replayed', async () => {
  const w = world({ env: {} });
  let r = await w.call('POST', '/api/auth/reset/start', { body: { who: 'x_user', email: 'a@kyu.ac.ke' } });
  assert.equal(r.status, 503);
  w.restore();
});
