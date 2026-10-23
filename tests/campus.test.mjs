import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
const fresh = async (t, o) => { const w = world(o); t.after(() => w.restore()); return w; };

test('campus: the list of campuses and spot categories is public', async (t) => {
  const w = await fresh(t);
  const r = await w.call('GET', '/api/campuses');
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.campuses.slice(0, 2).map((c) => c.id), ['kirinyaga', 'uon']);
  assert.ok(r.data.campuses.length > 2, 'all universities are listed');
  assert.ok(r.data.categories.includes('Food'));
});

test('campus: posts are tagged with your campus and the feed only shows that campus', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const mk = (campus, content) => w.call('POST', '/api/posts', { as: a, campus, body: { aid: a.aid, content, category: 'General' } });
  assert.equal((await mk('uon', 'Library at UoN is packed')).status, 201);
  assert.equal((await mk('kirinyaga', 'Kirinyaga cafeteria queue')).status, 201);
  const uon = (await w.call('GET', '/api/posts?limit=20', { campus: 'uon' })).data.posts;
  assert.deepEqual(uon.map((p) => p.content), ['Library at UoN is packed']);
  const kyu = (await w.call('GET', '/api/posts?limit=20', { campus: 'kirinyaga' })).data.posts;
  assert.deepEqual(kyu.map((p) => p.content), ['Kirinyaga cafeteria queue']);
  assert.equal((await w.call('GET', '/api/posts?limit=20', { campus: 'nonsense' })).data.posts.length, 2, 'an unknown campus is ignored, nothing is hidden');
});

test('campus: Wi-Fi, services and roommates follow the campus; the market does not', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const room = (campus) => w.call('POST', '/api/c/rooms', { as: a, campus, body: { kind: 'looking', title: 'Need a room near ' + campus, details: 'Quiet please', rent: 4000 } });
  assert.equal((await room('uon')).status, 201); assert.equal((await room('kirinyaga')).status, 201);
  assert.deepEqual((await w.call('GET', '/api/c/rooms', { campus: 'uon' })).data.items.map((x) => x.title), ['Need a room near uon']);
  assert.equal((await w.call('GET', '/api/c/rooms')).data.items.length, 2, 'no campus picked: everything');
  const svc = await w.call('POST', '/api/c/services', { as: a, campus: 'uon', body: { title: 'Laptop repair', category: 'Tech' } });
  assert.equal(svc.status, 201);
  assert.equal((await w.call('GET', '/api/c/services', { campus: 'kirinyaga' })).data.items.length, 0);
  assert.equal((await w.call('GET', '/api/c/services', { campus: 'uon' })).data.items.length, 1);
  // listings in the market are never filtered by campus
  assert.equal((await w.call('GET', '/api/market/listings', { campus: 'uon' })).status, 200);
});

test('land spots: add, list by campus, like once, only the owner removes, nobody sees the account id', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  assert.equal((await w.call('POST', '/api/spots', { body: { name: 'Quiet corner' } })).status, 401, 'sign in to add');
  assert.equal((await w.call('POST', '/api/spots', { as: a, campus: 'uon', body: { name: 'x' } })).status, 400);
  assert.equal((await w.call('POST', '/api/spots', { as: a, campus: 'uon', body: { name: 'Call 0712345678 for chips' } })).status, 400, 'no phone numbers');
  assert.equal((await w.call('POST', '/api/spots', { as: a, campus: 'uon', body: { name: 'Far away', lat: 51.5, lng: -0.12 } })).status, 400, 'pins must be in Kenya');
  const s = await w.call('POST', '/api/spots', { as: a, campus: 'uon', body: { name: 'Mama Oliech chips', category: 'Food', details: 'Best chips after class', lat: -1.2794, lng: 36.8167 } });
  assert.equal(s.status, 201); assert.equal(s.data.mine, true); assert.equal(s.data.campus, 'uon');
  await w.call('POST', '/api/spots', { as: b, campus: 'kirinyaga', body: { name: 'Library steps', category: 'Study' } });
  const uon = (await w.call('GET', '/api/spots', { campus: 'uon', as: b })).data;
  assert.equal(uon.spots.length, 1); assert.equal(uon.spots[0].name, 'Mama Oliech chips'); assert.equal(uon.spots[0].mine, false);
  assert.ok(!JSON.stringify(uon).includes(a.aid));
  assert.equal((await w.call('GET', '/api/spots?category=Study', { campus: 'uon' })).data.spots.length, 0);
  const id = s.data.id;
  assert.deepEqual((await w.call('POST', `/api/spots/${id}/like`, { as: b })).data, { liked: true, likes: 1 });
  assert.deepEqual((await w.call('POST', `/api/spots/${id}/like`, { as: b })).data, { liked: false, likes: 0 });
  assert.equal((await w.call('POST', `/api/spots/${id}/remove`, { as: b })).status, 403);
  assert.equal((await w.call('POST', `/api/spots/${id}/remove`, { as: a })).status, 200);
  assert.equal((await w.call('GET', '/api/spots', { campus: 'uon' })).data.spots.length, 0);
});
