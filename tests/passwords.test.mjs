import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
import { passwordScore, pwnedFromRange, passwordProblem } from '../backend/src/passwords.js';
const fresh = async (t, o) => { const w = world(o); t.after(() => w.restore()); return w; };

test('password score: common, patterned and short passwords are weak; long random ones are strong', () => {
  for (const pw of ['password', 'Password123', 'comrade123', 'kirinyaga', '12345678', 'qwertyuiop', 'aaaaaaaa', 'short1']) assert.ok(passwordScore(pw) <= 1, pw + ' should be weak');
  assert.ok(passwordScore('Mango2024') <= 1, 'word + year is weak');
  assert.ok(passwordScore('river-lamp-stone-moon') >= 3);
  assert.equal(passwordScore('Xk7m-Pq2R-vN9t-Lw4c'), 4);
  assert.ok(passwordScore('tomwanjiru2', 'tomwanjiru') <= 1, 'containing the username caps the score');
  assert.ok(passwordScore('abcdefgh') <= 1);
});

test('breach check parsing', () => {
  const body = '0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2\n011053FD0102E94D6AE2F8B83D76FAF94F6:1';
  assert.equal(pwnedFromRange(body, '00D4F6E8FA6EECAD2A3AA415EEC418D38EC'), 2);
  assert.equal(pwnedFromRange(body, 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'), 0);
  assert.equal(pwnedFromRange('{}', 'ABC'), 0);
});

test('sign-up and password change refuse weak passwords, accept strong ones', async (t) => {
  const w = await fresh(t, { env: { PWNED_CHECK: '0' } });
  const reg = (handle, password, n) => w.call('POST', '/api/auth/register', { body: { handle, password }, ip: '7.7.7.' + n });
  const r1 = await reg('weakling', 'password123', 1); assert.equal(r1.status, 400); assert.match(r1.data.error, /too easy to guess/);
  assert.equal((await reg('weakling', 'weakling99', 2)).status, 400, 'contains the username');
  assert.equal((await reg('weakling', 'short', 3)).status, 400);
  const ok = await reg('strongone', 'Xk7m-Pq2R-vN9t', 4); assert.equal(ok.status, 201);
  const me = { aid: ok.data.aid, token: ok.data.token, ipn: 50 };
  assert.equal((await w.call('POST', '/api/me/credentials', { as: me, body: { handle: 'strongone', password: 'qwerty123', current: 'Xk7m-Pq2R-vN9t' } })).status, 400);
  assert.equal((await w.call('POST', '/api/me/credentials', { as: me, body: { handle: 'strongone', password: 'river-lamp-stone-moon', current: 'Xk7m-Pq2R-vN9t' } })).status, 200);
  // and the new password really signs in
  assert.equal((await w.call('POST', '/api/auth/recover', { body: { handle: 'strongone', password: 'river-lamp-stone-moon' }, ip: '7.7.7.9' })).status, 200);
});

test('a password found in many breaches is refused; a failing breach service never blocks sign-up', async () => {
  const sha1 = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const pw = 'Xk7m-Pq2R-vN9t', h = await sha1(pw), real = globalThis.fetch;
  try {
    globalThis.fetch = async (u) => { assert.ok(String(u).endsWith('/range/' + h.slice(0, 5))); return new Response('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1\r\n' + h.slice(5) + ':4021'); };
    assert.match(await passwordProblem({}, pw, 'someone'), /data breaches/);
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal(await passwordProblem({}, pw, 'someone'), null);
    globalThis.fetch = async () => new Response('x', { status: 503 });
    assert.equal(await passwordProblem({}, pw, 'someone'), null);
  } finally { globalThis.fetch = real; }
});
