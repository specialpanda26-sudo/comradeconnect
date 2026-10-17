import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
const fresh = async (t) => { const w = world(); t.after(() => w.restore()); return w; };
const YT = 'https://www.youtube.com/watch?v=abcdefghijk';
async function goLive(w, host) {
  await w.call('POST', `/api/admin/users/${host.aid}`, { admin: true, body: { action: 'role', role: 'club_admin' } });
  const r = await w.call('POST', '/api/live/start', { as: host, body: { title: 'Graduation', url: YT } });
  assert.equal(r.status, 201); return r.data.id;
}

test('live: list shows viewers and hearts; ping counts each phone once and returns comments', async (t) => {
  const w = await fresh(t); const host = await w.user('h'), a = await w.user('a'), b = await w.user('b');
  const id = await goLive(w, host);
  let r = await w.call('POST', `/api/live/${id}/ping`, { body: { v: 'phone1' }, ip: '1.1.1.1' });
  assert.equal(r.status, 200); assert.equal(r.data.status, 'live'); assert.equal(r.data.viewers, 1);
  await w.call('POST', `/api/live/${id}/ping`, { body: { v: 'phone1' }, ip: '1.1.1.1' });
  r = await w.call('POST', `/api/live/${id}/ping`, { body: { v: 'phone2' }, ip: '2.2.2.2' });
  assert.equal(r.data.viewers, 2, 'same phone pinging again is not counted twice');
  const list = (await w.call('GET', '/api/live')).data.streams[0];
  assert.equal(list.viewers, 2); assert.equal(list.hearts, 0);
  // old viewers stop counting
  for (const x of w.db.rows('live_viewers')) x.seen_at = new Date(Date.now() - 120e3).toISOString();
  assert.equal((await w.call('POST', `/api/live/${id}/ping`, { body: { v: 'phone3' }, ip: '3.3.3.3' })).data.viewers, 1);
});

test('live: comments need an account, block phone numbers and links, and arrive in order for everyone', async (t) => {
  const w = await fresh(t); const host = await w.user('h'), a = await w.user('a');
  const id = await goLive(w, host);
  assert.equal((await w.call('POST', `/api/live/${id}/comment`, { body: { text: 'hi' } })).status, 401, 'no account, no comment');
  assert.equal((await w.call('POST', `/api/live/${id}/comment`, { as: a, body: { text: '   ' } })).status, 400);
  assert.equal((await w.call('POST', `/api/live/${id}/comment`, { as: a, body: { text: 'call me 0712345678' } })).status, 400);
  assert.equal((await w.call('POST', `/api/live/${id}/comment`, { as: a, body: { text: 'see https://x.co/a' } })).status, 400);
  const c1 = await w.call('POST', `/api/live/${id}/comment`, { as: a, body: { text: 'Congrats graduands!' + 'x'.repeat(300) } });
  assert.equal(c1.status, 201); assert.equal(c1.data.text.length, 140, 'comments are cut at 140 characters'); assert.equal(c1.data.name, 'Comrade');
  const first = (await w.call('POST', `/api/live/${id}/ping`, { body: { v: 'p' } })).data.comments;
  assert.equal(first.length, 1);
  await new Promise((r) => setTimeout(r, 5));
  await w.call('POST', `/api/live/${id}/comment`, { as: a, body: { text: 'second' } });
  const more = (await w.call('POST', `/api/live/${id}/ping`, { body: { v: 'p', since: first[0].at } })).data.comments;
  assert.deepEqual(more.map((c) => c.text), ['second'], 'only new comments after "since"');
  assert.equal(JSON.stringify(first).includes(a.aid), false, 'a comment never shows the account id');
});

test('live: hearts add up, are capped per request, and stop when the stream ends', async (t) => {
  const w = await fresh(t); const host = await w.user('h');
  const id = await goLive(w, host);
  assert.equal((await w.call('POST', `/api/live/${id}/heart`, { body: { n: 3 } })).data.hearts, 3);
  assert.equal((await w.call('POST', `/api/live/${id}/heart`, { body: { n: 500 } })).status, 400, 'one request cannot add hundreds');
  assert.equal((await w.call('POST', `/api/live/${id}/heart`, { body: { n: 0 } })).status, 400);
  assert.equal((await w.call('POST', `/api/live/${id}/ping`, { body: { v: 'p' } })).data.hearts, 3);
  await w.call('POST', `/api/live/${id}/end`, { as: host });
  assert.equal((await w.call('POST', `/api/live/${id}/heart`, { body: { n: 1 } })).status, 404);
  assert.equal((await w.call('POST', `/api/live/${id}/ping`, { body: { v: 'p' } })).data.status, 'ended');
  assert.equal((await w.call('POST', `/api/live/${id}/comment`, { as: await w.user('z'), body: { text: 'late' } })).status, 404);
});

test('live: only the host or an admin can remove a comment; the cron clears old viewers and comments', async (t) => {
  const w = await fresh(t); const host = await w.user('h'), a = await w.user('a'), other = await w.user('o');
  const id = await goLive(w, host);
  const c = (await w.call('POST', `/api/live/${id}/comment`, { as: a, body: { text: 'rude one' } })).data;
  assert.equal((await w.call('POST', `/api/live/${id}/comment/${c.id}/remove`, { as: other })).status, 403);
  assert.equal((await w.call('POST', `/api/live/${id}/comment/${c.id}/remove`, { as: a })).status, 403, 'even the writer cannot, only the host');
  assert.equal((await w.call('POST', `/api/live/${id}/comment/${c.id}/remove`, { as: host })).status, 200);
  assert.equal((await w.call('POST', `/api/live/${id}/ping`, { body: { v: 'p' } })).data.comments.length, 0);
  const keep = (await w.call('POST', `/api/live/${id}/comment`, { as: a, body: { text: 'kept' } })).data;
  w.db.rows('live_comments').find((x) => x.id === keep.id).created_at = new Date(Date.now() - 4 * 86400e3).toISOString();
  w.db.rows('live_viewers').push({ stream_id: id, viewer: 'old', seen_at: new Date(Date.now() - 7200e3).toISOString() });
  await w.cron();
  assert.equal(w.db.rows('live_comments').some((x) => x.id === keep.id), false, 'comments older than 3 days are deleted');
  assert.equal(w.db.rows('live_viewers').some((x) => x.viewer === 'old'), false);
});
