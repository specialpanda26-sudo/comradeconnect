import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
import { mailReady } from '../backend/src/mail.js';

const BREVO = { BREVO_API_KEY: 'xkeysib-test', MAIL_FROM: 'Comrade Connect <no-reply@test.ke>', STUDENT_EMAIL_DOMAINS: 'ac.ke' };
const sent = (w) => w.calls.filter((x) => x.url.includes('api.brevo.com'));

test('mail: Brevo is used when its key is set, Resend otherwise; both need MAIL_FROM', async () => {
  assert.equal(mailReady({}), false);
  assert.equal(mailReady({ BREVO_API_KEY: 'k' }), false);
  assert.equal(mailReady({ BREVO_API_KEY: 'k', MAIL_FROM: 'a@b.ke' }), true);
  assert.equal(mailReady({ RESEND_API_KEY: 'k', MAIL_FROM: 'a@b.ke' }), true);
  const w = world({ env: BREVO }); const a = await w.user('a');
  const r = await w.call('POST', '/api/verify/email/start', { as: a, body: { email: 'jane@students.uonbi.ac.ke' } });
  assert.equal(r.status, 200);
  const call = sent(w)[0], b = JSON.parse(call.init.body);
  assert.equal(call.init.headers['api-key'], 'xkeysib-test');
  assert.deepEqual(b.sender, { name: 'Comrade Connect', email: 'no-reply@test.ke' });
  assert.deepEqual(b.to, [{ email: 'jane@students.uonbi.ac.ke' }]);
  w.restore();
});

import { normStudentEmail } from '../backend/src/trust.js';

test('student email: ac.ke covers every Kenyan university and keeps each university separate', () => {
  const env = { STUDENT_EMAIL_DOMAINS: 'ac.ke,strathmore.edu' };
  assert.equal(normStudentEmail(env, 'john@students.uonbi.ac.ke').canon, 'john@uonbi.ac.ke');
  assert.equal(normStudentEmail(env, 'john@jkuat.ac.ke').canon, 'john@jkuat.ac.ke');
  assert.equal(normStudentEmail(env, 'john@strathmore.edu').canon, 'john@strathmore.edu');
  for (const bad of ['john@gmail.com', 'john@ac.ke.evil.com', 'john@notac.ke']) assert.equal(normStudentEmail(env, bad), null, bad);
});
