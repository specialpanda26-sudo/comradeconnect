import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const BREVO = { BREVO_API_KEY: 'xkeysib-test', MAIL_FROM: 'Comrade Connect <no-reply@test.ke>', STUDENT_EMAIL_DOMAINS: 'ac.ke' };
const sent = (w) => w.calls.filter((x) => x.url.includes('api.brevo.com'));
const codeAt = (w, i) => JSON.parse(sent(w)[i].init.body).textContent.match(/code is (\d{6})/)[1];
const ago = (w) => { for (const r of w.db.rows('email_verifications')) r.sent_at = new Date(Date.now() - 120e3).toISOString(); };

test('only 2 codes a day, and the first code still works after the second', async () => {
  const w = world({ env: BREVO }); const a = await w.user('a');
  const ask = () => w.call('POST', '/api/verify/email/start', { as: a, body: { email: 'jane@kyu.ac.ke' }, ip: '7.7.7.1' });
  let r = await ask(); assert.equal(r.status, 200);
  ago(w); r = await ask(); assert.equal(r.status, 200);
  assert.equal(sent(w).length, 2);
  ago(w); r = await ask(); assert.equal(r.status, 429); assert.match(r.data.error, /2 codes a day/);
  assert.equal(sent(w).length, 2);
  r = await w.call('POST', '/api/verify/email/confirm', { as: a, body: { code: codeAt(w, 0) } });
  assert.equal(r.status, 200);
  r = await w.call('POST', '/api/verify/email/confirm', { as: a, body: { code: codeAt(w, 0) } });
  assert.equal(r.status, 410); assert.match(r.data.error, /already been used/);
  w.restore();
});
