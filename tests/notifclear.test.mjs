import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
const fresh = async (t, o) => { const w = world(o); t.after(() => w.restore()); return w; };

test('clear all: removes your notifications for good and cannot touch anyone else\'s', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  const p = await w.call('POST', '/api/posts', { body: { aid: a.aid, content: 'Who has seen the new canteen menu', category: 'General' } });
  const q = await w.call('POST', '/api/posts', { body: { aid: b.aid, content: 'Anyone selling a calculator', category: 'General' } });
  for (const x of ['one', 'two']) await w.call('POST', `/api/posts/${p.data._id}/comments`, { body: { aid: b.aid, text: 'comment ' + x } });
  await w.call('POST', `/api/posts/${q.data._id}/comments`, { body: { aid: a.aid, text: 'I have one' } });
  assert.equal((await w.call('GET', '/api/notifications', { as: a })).data.items.length, 2);
  await w.call('POST', '/api/notifications/clear', { as: b, body: { all: true } });
  assert.equal((await w.call('GET', '/api/notifications', { as: a })).data.items.length, 2, 'a is untouched');
  assert.equal((await w.call('GET', '/api/notifications', { as: b })).data.items.length, 0);
  const one = (await w.call('GET', '/api/notifications', { as: a })).data.items[0].id;
  await w.call('POST', '/api/notifications/clear', { as: a, body: { ids: [one] } });
  assert.equal((await w.call('GET', '/api/notifications', { as: a })).data.items.length, 1);
  await w.call('POST', '/api/notifications/clear', { as: a, body: { all: true, events: true } });
  assert.equal((await w.call('GET', '/api/notifications', { as: a })).data.items.length, 0);
  assert.equal((await w.call('POST', '/api/notifications/clear', { body: { all: true } })).status, 401, 'needs an account');
});
