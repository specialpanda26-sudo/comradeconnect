import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
const fresh = async (t) => { const w = world(); t.after(() => w.restore()); return w; };
const up = (w, as, kind, extra = {}) => w.call('POST', '/api/media/upload-url', { as, body: { kind, content_type: kind === 'service_video' ? 'video/mp4' : 'image/jpeg', bytes: 1e6, ...extra } });

test('service work: owner adds photos and a video, everyone sees them, owner can remove', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  const sv = (await w.call('POST', '/api/c/services', { as: a, body: { title: 'Mama Fix washing machines', category: 'General', details: 'Repairs' } })).data;
  assert.equal((await up(w, b, 'service_photo', { service_id: sv.id })).status, 404, 'not your service');
  assert.equal((await up(w, a, 'service_photo')).status, 400, 'needs a service id');
  const p = await up(w, a, 'service_photo', { service_id: sv.id });
  assert.equal(p.status, 201);
  const v = await up(w, a, 'service_video', { service_id: sv.id });
  assert.equal(v.status, 201);
  assert.equal((await up(w, a, 'service_video', { service_id: sv.id, bytes: 40 * 1048576 })).status, 400, 'video too big');
  assert.equal((await w.call('GET', '/api/c/services')).data.items[0].works.length, 0, 'pending uploads are hidden');
  for (const r of w.db.rows('media')) w.env.MEDIA.put(r.r2_key, 1e6);
  // the fake bucket has no real file bytes, so mark them ready the way /complete would
  for (const r of w.db.rows('media')) r.status = 'ready';
  const list = (await w.call('GET', '/api/c/services', { as: b })).data.items[0];
  assert.deepEqual(list.works.map((x) => x.type).sort(), ['photo', 'video']);
  assert.ok(list.works[0].url.startsWith('https://media.test/'));
  assert.equal((await w.call('POST', `/api/services/work/${list.works[0].id}/remove`, { as: b, body: {} })).status, 404, 'only the owner removes');
  assert.equal((await w.call('POST', `/api/services/work/${list.works[0].id}/remove`, { as: a, body: {} })).status, 200);
  assert.equal((await w.call('GET', '/api/c/services')).data.items[0].works.length, 1);
});

test('service work: photo and video limits', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const sv = (await w.call('POST', '/api/c/services', { as: a, body: { title: 'Quick Print Point' } })).data;
  for (let i = 0; i < 6; i++) assert.equal((await up(w, a, 'service_photo', { service_id: sv.id })).status, 201);
  assert.equal((await up(w, a, 'service_photo', { service_id: sv.id })).status, 400, 'max 6 photos');
});
