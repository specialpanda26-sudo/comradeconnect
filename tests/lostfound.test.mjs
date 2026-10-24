import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
const fresh = async (t) => { const w = world(); t.after(() => w.restore()); return w; };

test('lost and found: post, list by campus, no numbers, owner marks returned', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  const mk = (as, body, campus) => w.call('POST', '/api/lostfound', { as, body, campus });
  assert.equal((await mk(a, { kind: 'found', category: 'National ID', title: 'National ID found at the library', place: 'Library' }, 'kirinyaga')).status, 201);
  assert.equal((await mk(a, { kind: 'found', category: 'National ID', title: 'ID number 12345678' }, 'kirinyaga')).status, 400, 'ID numbers are refused');
  assert.equal((await mk(a, { kind: 'lost', title: 'Call me 0712345678' }, 'kirinyaga')).status, 400, 'phone numbers are refused');
  assert.equal((await mk(a, { kind: 'lost', title: 'Black phone', category: 'Phone' }, 'uon')).status, 201);
  const ky = (await w.call('GET', '/api/lostfound', { campus: 'kirinyaga' })).data;
  assert.deepEqual(ky.items.map((x) => x.title), ['National ID found at the library']);
  const id = ky.items[0].id;
  assert.equal((await w.call('POST', `/api/lostfound/${id}/returned`, { as: b, body: {} })).status, 403, 'only the poster');
  assert.equal((await w.call('POST', `/api/lostfound/${id}/returned`, { as: a, body: {} })).status, 200);
  const after = (await w.call('GET', '/api/lostfound', { campus: 'kirinyaga' })).data;
  assert.equal(after.items.length, 0); assert.equal(after.reunited, 1);
  assert.equal((await w.call('GET', '/api/lostfound?status=returned', { campus: 'kirinyaga' })).data.items.length, 1);
});

test('lost and found: signed-in only, and a chat can start from a post', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  assert.equal((await w.call('POST', '/api/lostfound', { body: { kind: 'lost', title: 'Keys' } })).status, 401);
  const it = (await w.call('POST', '/api/lostfound', { as: a, body: { kind: 'found', title: 'Student ID card', category: 'Student ID' } })).data;
  const s = await w.call('POST', '/api/messages/send', { as: b, body: { ref_type: 'lostfound', ref_id: it.id, body: 'I think that is mine' } });
  assert.equal(s.status, 201);
});
