import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

test('login is limited: wrong guesses stop at 429', async (t) => {
  const w = world(); t.after(() => w.restore());
  const a = await w.user('lim');
  for (let i = 0; i < 15; i++) assert.equal((await w.call('POST', '/api/auth/recover', { body: { aid: a.aid, password: 'wrong' + i }, ip: '7.7.7.7' })).status, 401);
  assert.equal((await w.call('POST', '/api/auth/recover', { body: { aid: a.aid, password: 'wrong-again' }, ip: '7.7.7.7' })).status, 429);
});

test('a wrong admin key is counted on every endpoint; the right key still works', async (t) => {
  const w = world(); t.after(() => w.restore());
  for (let i = 0; i < 20; i++) assert.equal((await w.call('GET', '/api/admin/sql', { admin: 'bad' + i, ip: '8.8.8.8' })).status, 403);
  assert.equal((await w.call('GET', '/api/admin/sql', { admin: 'bad-last', ip: '8.8.8.8' })).status, 429);
  assert.equal((await w.call('POST', '/api/admin/login', { admin: true, ip: '8.8.8.8' })).status, 200);
});
