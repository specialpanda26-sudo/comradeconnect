// Anyone with an account can go live; the live shows viewers, comments and reactions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
const fresh = async (t) => { const w = world(); t.after(() => w.restore()); return w; };

test('a normal account can go live from the phone camera and with a link', async (t) => {
  const w = await fresh(t); const u = await w.user('u');
  const a = await w.call('POST', '/api/live/start', { as: u, body: { title: 'Match day', native: true } });
  assert.equal(a.status, 201); assert.equal(a.data.native, true);
  const b = await w.call('POST', '/api/live/start', { as: u, body: { title: 'Stream', url: 'https://www.youtube.com/watch?v=abcdefghijk' } });
  assert.equal(b.status, 201);
  assert.equal((await w.call('GET', '/api/live')).data.streams.length, 1, 'starting a new live ends the previous one');
});

test('going live still needs an account', async (t) => {
  const w = await fresh(t);
  const r = await w.call('POST', '/api/live/start', { body: { title: 'Anon', native: true } });
  assert.ok([401, 403].includes(r.status), String(r.status));
});

test('ping returns viewers, comment count and reactions (hearts)', async (t) => {
  const w = await fresh(t); const host = await w.user('h'), a = await w.user('a'), b = await w.user('b');
  const id = (await w.call('POST', '/api/live/start', { as: host, body: { title: 'Live', native: true } })).data.id;
  await w.call('POST', `/api/live/${id}/comment`, { as: a, body: { text: 'hello' } });
  await w.call('POST', `/api/live/${id}/comment`, { as: b, body: { text: 'nice' } });
  await w.call('POST', `/api/live/${id}/heart`, { body: { n: 3 } });
  const r = await w.call('POST', `/api/live/${id}/ping`, { body: { v: 'p1' }, ip: '1.1.1.1' });
  assert.equal(r.data.viewers, 1); assert.equal(r.data.comment_count, 2); assert.equal(r.data.hearts, 3);
  await w.call('POST', `/api/live/${id}/comment/${r.data.comments[0].id}/remove`, { as: host, body: {} });
  assert.equal((await w.call('POST', `/api/live/${id}/ping`, { body: { v: 'p1' }, ip: '1.1.1.1' })).data.comment_count, 1, 'removed comments are not counted');
});

test('a banned account cannot go live', async (t) => {
  const w = await fresh(t); const u = await w.user('u');
  await w.call('POST', `/api/admin/users/${u.aid}`, { admin: true, body: { action: 'ban' } });
  const r = await w.call('POST', '/api/live/start', { as: u, body: { title: 'x', native: true } });
  assert.ok(r.status >= 400, String(r.status));
});
