import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const ENV = { BREVO_API_KEY: 'xkeysib-test', MAIL_FROM: 'Comrade Connect <no-reply@test.ke>', STUDENT_EMAIL_DOMAINS: 'kyu.ac.ke' };
const mails = (w) => w.calls.filter((x) => x.url.includes('api.brevo.com')).map((x) => JSON.parse(x.init.body));
const lastCode = (w) => mails(w).pop().textContent.match(/code is (\d{6})/)[1];
const NEWPW = 'Xk7m-Pq2R-vN9t-Lw4c', NEWPW2 = 'Tg5n-Hb8W-yQ3z-Df6j';
let ip = 0; const nip = () => '7.7.' + (++ip) + '.1';

async function saveEmail(w, acct, email) {
  let r = await w.call('POST', '/api/me/recovery-email/start', { as: acct, body: { email } }); assert.equal(r.status, 200);
  r = await w.call('POST', '/api/me/recovery-email/confirm', { as: acct, body: { code: lastCode(w) } }); assert.equal(r.status, 200);
}
const ask = (w, email) => w.call('POST', '/api/auth/reset/start', { body: { email }, ip: nip() });

test('wrong-code answers are the same for a real account and for an email nobody has (no account finder)', async () => {
  const w = world({ env: ENV }); const a = await w.user('a');
  await saveEmail(w, a, 'real.person@gmail.com');
  await ask(w, 'real.person@gmail.com'); await ask(w, 'ghost.nobody@gmail.com');
  const real = lastCode(w), wrong = real === '000000' ? '111111' : '000000';
  const run = async (email) => { const out = []; for (let i = 0; i < 7; i++) { const r = await w.call('POST', '/api/auth/reset/confirm', { body: { email, code: wrong, password: NEWPW }, ip: '8.8.8.8' }); out.push([r.status, r.data.error]); } return out; };
  const seenReal = await run('real.person@gmail.com'), seenGhost = await run('ghost.nobody@gmail.com');
  assert.deepEqual(seenReal, seenGhost, 'the two emails must get identical answers');
  assert.equal(seenReal[0][0], 400); assert.ok(!/tries left/.test(seenReal[0][1]));
  assert.equal(seenReal[5][0], 429);
  w.restore();
});

test('+tags: a code is only emailed when the typed address is the same mailbox as the saved one', async () => {
  const w = world({ env: ENV }); const a = await w.user('a'), g = await w.user('g');
  await saveEmail(w, a, 'bob@school-mail.example.org');
  await saveEmail(w, g, 'Mary.Wanjiku@Gmail.com');
  let n = mails(w).length;
  await ask(w, 'bob+attacker@school-mail.example.org');
  assert.equal(mails(w).length, n, 'bob+x@ on a normal provider is NOT bob@: nothing is sent');
  await ask(w, 'bob@school-mail.example.org');
  assert.equal(mails(w).length, n + 1); assert.equal(mails(w).pop().to[0].email, 'bob@school-mail.example.org');
  n = mails(w).length;
  await ask(w, 'm.a.r.y.wanjiku+zz@GMAIL.com');
  assert.equal(mails(w).length, n + 1); assert.equal(mails(w).pop().to[0].email, 'm.a.r.y.wanjiku+zz@gmail.com');
  w.restore();
});

test('+tags on a student email do not reach the account either', async () => {
  const w = world({ env: ENV }); const a = await w.user('a');
  let r = await w.call('POST', '/api/verify/email/start', { as: a, body: { email: 'jane@kyu.ac.ke' } }); assert.equal(r.status, 200);
  r = await w.call('POST', '/api/verify/email/confirm', { as: a, body: { code: lastCode(w) } }); assert.equal(r.status, 200);
  let n = mails(w).length;
  await ask(w, 'jane+x@kyu.ac.ke'); assert.equal(mails(w).length, n);
  await ask(w, 'jane@kyu.ac.ke'); assert.equal(mails(w).length, n + 1);
  w.restore();
});

test('one reset code cannot be used twice, even by two taps at the same moment', async () => {
  const w = world({ env: ENV }); const a = await w.user('a');
  await saveEmail(w, a, 'twice@gmail.com'); await ask(w, 'twice@gmail.com'); const code = lastCode(w);
  const go = (password) => w.call('POST', '/api/auth/reset/confirm', { body: { email: 'twice@gmail.com', code, password }, ip: nip() });
  const [x, y] = await Promise.all([go(NEWPW), go(NEWPW2)]);
  assert.deepEqual([x.status, y.status].sort(), [200, 410], 'exactly one wins');
  assert.equal((await go(NEWPW)).status, 410);
  w.restore();
});

test('saving an email another account has gives a vague answer and is rate limited', async () => {
  const w = world({ env: ENV }); const a = await w.user('a'), b = await w.user('b');
  await saveEmail(w, a, 'taken@gmail.com');
  await w.call('POST', '/api/me/recovery-email/start', { as: b, body: { email: 'taken@gmail.com' } });
  const r = await w.call('POST', '/api/me/recovery-email/confirm', { as: b, body: { code: lastCode(w) } });
  assert.equal(r.status, 400); assert.equal(r.data.error, 'Could not save that email. Try another one.');
  let last = 0; for (let i = 0; i < 40; i++) last = (await w.call('POST', '/api/me/recovery-email/confirm', { as: b, body: { code: '123456' } })).status;
  assert.equal(last, 429, 'confirm must be rate limited');
  w.restore();
});
