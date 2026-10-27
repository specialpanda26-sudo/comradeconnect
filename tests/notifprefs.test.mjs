import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
const fresh = async (t, o) => { const w = world(o); t.after(() => w.restore()); return w; };

test('alert choices: everything starts on, each kind can be switched off, junk is ignored, and people only change their own', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  let r = await w.call('GET', '/api/notifications/prefs', { as: a });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.data.prefs).sort(), ['comments', 'events', 'live', 'messages', 'orders', 'updates', 'wallet']);
  assert.ok(Object.values(r.data.prefs).every((v) => v === true));
  r = await w.call('POST', '/api/notifications/prefs', { as: a, body: { prefs: { live: false, events: false, hacker: false, comments: 'no' } } });
  assert.equal(r.status, 200);
  r = await w.call('GET', '/api/notifications/prefs', { as: a });
  assert.equal(r.data.prefs.live, false); assert.equal(r.data.prefs.events, false);
  assert.equal(r.data.prefs.comments, true, 'only a real false switches a kind off');
  assert.equal(r.data.prefs.hacker, undefined);
  assert.ok((await w.call('GET', '/api/notifications/prefs', { as: b })).data.prefs.live, 'b is untouched');
  assert.equal((await w.call('GET', '/api/notifications/prefs')).status, 401, 'needs an account');
  r = await w.call('POST', '/api/notifications/prefs', { as: a, body: { prefs: { live: true, events: true } } });
  assert.ok(Object.values((await w.call('GET', '/api/notifications/prefs', { as: a })).data.prefs).every((v) => v === true), 'allow all');
});
