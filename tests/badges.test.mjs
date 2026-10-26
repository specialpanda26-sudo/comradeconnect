import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

test('badge kinds: student black, official blue, business pink, Comrade Connect account unique; names are reserved', async (t) => {
  const w = world(); t.after(() => w.restore());
  const a = await w.user('a');
  const me = async () => (await w.call('GET', '/api/me', { as: a })).data;
  assert.equal((await me()).badge_kind, null);
  const set = (kind) => w.call('POST', '/api/admin/users/' + a.aid, { admin: true, body: { action: 'badge', kind } });
  w.db.rows('profiles').find((p) => p.aid === a.aid).student_verified = true;
  assert.equal((await me()).badge_kind, 'student');
  assert.equal((await set('official')).status, 200); assert.equal((await me()).badge_kind, 'official');
  assert.equal((await set('business')).status, 200); assert.equal((await me()).badge_kind, 'business');
  assert.equal((await set('cc')).status, 200); assert.equal((await me()).badge_kind, 'cc');
  assert.equal((await set('none')).status, 200); assert.equal((await me()).badge_kind, 'student');
  assert.equal((await set('gold')).status, 400);
  assert.equal((await w.call('POST', '/api/admin/users/' + a.aid, { body: { action: 'badge', kind: 'cc' } })).status, 403);
  // reserved names
  assert.equal((await w.call('POST', '/api/me/handle', { as: a, body: { handle: 'ComradeConnect' } })).status, 403);
  assert.equal((await w.call('POST', '/api/me/handle', { as: a, body: { handle: 'comrade_connect_official' } })).status, 403);
  assert.equal((await w.call('POST', '/api/me/handle', { as: a, body: { handle: 'kamau_k' } })).status, 200);
  await set('cc');
  assert.equal((await w.call('POST', '/api/me/handle', { as: a, body: { handle: 'ComradeConnect' } })).status, 200);
  // the verify status the phone reads
  const s = (await w.call('GET', '/api/verify/status', { as: a })).data;
  assert.equal(s.kind, 'cc'); assert.equal(s.student, true);
});
