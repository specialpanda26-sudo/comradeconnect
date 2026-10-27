import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

test('admin test alert: reaches the bell, finds the handle in any letter case', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('wanjiku');
  w.db.rows('profiles').find((p) => p.aid === u.aid).handle = 'Wanjiku';
  w.db.rows('push_subs').push({ aid: u.aid, endpoint: 'fcm:tok123' });
  const r = await w.call('POST', '/api/admin/push/send', { admin: true, body: { title: 'Test alert', body: 'Hello from admin', handle: '@wanjiku' } });
  assert.equal(r.status, 200);
  assert.match(r.data.report[0], /Saved in their bell/);
  const n = await w.call('GET', '/api/notifications', { as: u });
  assert.equal(n.data.unread, 1);
  assert.equal(n.data.items[0].title, 'Test alert');
});

test('admin test alert: an unknown handle is refused and nothing is saved', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('x');
  const r = await w.call('POST', '/api/admin/push/send', { admin: true, body: { title: 'Test alert', body: 'Hello', handle: 'nobody_here' } });
  assert.equal(r.status, 400);
  assert.equal((await w.call('GET', '/api/notifications', { as: u })).data.items.length, 0);
});

test('admin test alert: an account with no phone still gets the bell entry and is told', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('nophone');
  w.db.rows('profiles').find((p) => p.aid === u.aid).handle = 'nophone';
  const r = await w.call('POST', '/api/admin/push/send', { admin: true, body: { title: 'Test alert', body: 'Hello', handle: 'nophone' } });
  assert.equal(r.status, 200);
  assert.match(r.data.report.join(' '), /no app phone/);
  assert.equal((await w.call('GET', '/api/notifications', { as: u })).data.unread, 1);
});
